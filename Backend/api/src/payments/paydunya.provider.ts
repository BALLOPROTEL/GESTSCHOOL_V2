import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type JsonObject = Record<string, unknown>;

export type PaydunyaCheckoutInput = {
  attemptId: string;
  tenantId: string;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

export type PaydunyaCheckoutResult = {
  token: string;
  checkoutUrl: string;
  raw: JsonObject;
};

export type PaydunyaCallbackData = {
  token: string;
  status: string;
  hash?: string;
  totalAmount?: number;
  receiptUrl?: string;
  failureReason?: string;
  raw: JsonObject;
};

@Injectable()
export class PaydunyaProvider {
  constructor(private readonly configService: ConfigService) {}

  async createCheckoutInvoice(input: PaydunyaCheckoutInput): Promise<PaydunyaCheckoutResult> {
    this.assertSandboxMode();
    const response = await this.fetchJson(this.endpoint("checkout-invoice/create"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        invoice: {
          items: {
            invoice: {
              name: `Facture ${input.invoiceNo}`,
              quantity: 1,
              unit_price: input.amount,
              total_price: input.amount,
              description: `Paiement de la facture ${input.invoiceNo}`
            }
          },
          customer: {
            name: input.customerName || "",
            email: input.customerEmail || "",
            phone: input.customerPhone || ""
          },
          total_amount: input.amount,
          description: `Paiement de la facture ${input.invoiceNo}`
        },
        store: {
          name: this.configService.get<string>("PAYDUNYA_STORE_NAME", "GestSchool")
        },
        custom_data: {
          tenantId: input.tenantId,
          invoiceId: input.invoiceId,
          attemptId: input.attemptId
        },
        actions: {
          callback_url: this.requiredConfig("PAYDUNYA_CALLBACK_URL"),
          return_url: this.requiredConfig("PAYDUNYA_RETURN_URL"),
          cancel_url: this.requiredConfig("PAYDUNYA_CANCEL_URL")
        }
      })
    });

    if (response.response_code !== "00") {
      throw new Error(`PayDunya rejected checkout invoice creation: ${this.safeResponseText(response)}`);
    }

    const token = this.stringValue(response.token);
    const checkoutUrl = this.stringValue(response.response_text);
    if (!token || !checkoutUrl) {
      throw new Error("PayDunya checkout response is missing token or checkout URL.");
    }

    return {
      token,
      checkoutUrl,
      raw: response
    };
  }

  async confirmPayment(token: string): Promise<PaydunyaCallbackData> {
    this.assertSandboxMode();
    const response = await this.fetchJson(
      this.endpoint(`checkout-invoice/confirm/${encodeURIComponent(token)}`),
      {
        method: "GET",
        headers: this.headers()
      }
    );
    return this.extractCallbackData(response);
  }

  extractCallbackData(body: unknown, query?: unknown): PaydunyaCallbackData {
    const raw = this.asObject(body);
    const queryObject = this.asObject(query);
    const data = this.asObject(this.parseMaybeJson(raw.data));
    const invoice = this.asObject(data.invoice || raw.invoice);
    const errors = this.asObject(data.errors || raw.errors);

    const token =
      this.stringValue(invoice.token) ||
      this.stringValue(data.token) ||
      this.stringValue(raw.token) ||
      this.stringValue(raw["data[invoice][token]"]) ||
      this.stringValue(queryObject.token);

    if (!token) {
      throw new Error("PayDunya callback is missing invoice token.");
    }

    const status =
      this.stringValue(data.status) ||
      this.stringValue(raw.status) ||
      this.stringValue(raw["data[status]"]) ||
      "pending";

    return {
      token,
      status: status.trim().toLowerCase(),
      hash:
        this.stringValue(data.hash) ||
        this.stringValue(raw.hash) ||
        this.stringValue(raw["data[hash]"]) ||
        undefined,
      totalAmount: this.numberValue(invoice.total_amount || raw.total_amount),
      receiptUrl:
        this.stringValue(data.receipt_url) ||
        this.stringValue(raw.receipt_url) ||
        this.stringValue(raw["data[receipt_url]"]) ||
        undefined,
      failureReason:
        this.stringValue(data.fail_reason) ||
        this.stringValue(raw.fail_reason) ||
        this.stringValue(errors.message) ||
        this.stringValue(errors.description) ||
        undefined,
      raw
    };
  }

  verifyCallbackHash(hash: string | undefined): boolean {
    if (!hash) {
      return false;
    }
    const expected = createHash("sha512")
      .update(this.requiredConfig("PAYDUNYA_MASTER_KEY"))
      .digest("hex");
    return hash.trim().toLowerCase() === expected;
  }

  mode(): "sandbox" {
    this.assertSandboxMode();
    return "sandbox";
  }

  private assertSandboxMode(): void {
    const provider = this.configService.get<string>("PAYMENT_PROVIDER", "mock").trim().toLowerCase();
    if (provider !== "paydunya") {
      throw new Error("PAYMENT_PROVIDER=paydunya is required to use PayDunya endpoints.");
    }
    const mode = this.configService.get<string>("PAYDUNYA_MODE", "sandbox").trim().toLowerCase();
    if (mode !== "sandbox") {
      throw new Error("PayDunya production mode is disabled for this phase. Use PAYDUNYA_MODE=sandbox.");
    }
  }

  private endpoint(path: string): string {
    return `https://app.paydunya.com/sandbox-api/v1/${path.replace(/^\/+/, "")}`;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": this.requiredConfig("PAYDUNYA_MASTER_KEY"),
      "PAYDUNYA-PRIVATE-KEY": this.requiredConfig("PAYDUNYA_PRIVATE_KEY"),
      "PAYDUNYA-TOKEN": this.requiredConfig("PAYDUNYA_TOKEN")
    };
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key, "").trim();
    if (!value) {
      throw new Error(`${key} is required for PayDunya sandbox integration.`);
    }
    return value;
  }

  private async fetchJson(url: string, init: RequestInit): Promise<JsonObject> {
    const timeoutMs = Number(this.configService.get<string>("PAYDUNYA_TIMEOUT_MS", "10000"));
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000
    );

    try {
      const response = await fetch(url, {
        ...init,
        signal: abortController.signal
      });
      const raw = await response.text();
      const parsed = this.asObject(this.parseMaybeJson(raw));
      if (!response.ok) {
        throw new Error(`PayDunya request failed (${response.status}): ${this.safeResponseText(parsed)}`);
      }
      return parsed;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private asObject(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private stringValue(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private numberValue(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private safeResponseText(value: JsonObject): string {
    return JSON.stringify({
      response_code: value.response_code,
      response_text: value.response_text,
      description: value.description,
      status: value.status
    }).slice(0, 500);
  }
}
