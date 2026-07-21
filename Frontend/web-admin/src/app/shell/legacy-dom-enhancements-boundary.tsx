import { useLayoutEffect, useRef, type ReactNode } from "react";

import {
  translateUiString,
  UI_LANGUAGE_ORDER,
  type UiLanguage
} from "../../shared/i18n";
import { decorateLegacyResponsiveTables } from "./responsive-tables";

type TranslatableAttribute = "placeholder" | "title" | "aria-label" | "alt" | "data-label";

const TRANSLATABLE_ATTRIBUTES: TranslatableAttribute[] = [
  "placeholder",
  "title",
  "aria-label",
  "alt",
  "data-label"
];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA"]);
const textSourceMap = new WeakMap<Text, string>();
const attributeSourceMap = new WeakMap<Element, Map<TranslatableAttribute, string>>();

const normalizeSource = (value: string): string => value.replace(/\s+/gu, " ").trim();

const isSourceOrKnownTranslation = (currentValue: string, source: string): boolean => {
  if (currentValue === source) return true;
  return UI_LANGUAGE_ORDER.some(
    (candidateLanguage) => translateUiString(candidateLanguage, source) === currentValue
  );
};

const translateTextNode = (node: Text, language: UiLanguage): void => {
  const currentValue = node.nodeValue ?? "";
  if (!normalizeSource(currentValue)) return;

  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("[data-i18n-skip='true']")) {
    return;
  }

  const previousSource = textSourceMap.get(node);
  const source =
    previousSource && isSourceOrKnownTranslation(currentValue, previousSource)
      ? previousSource
      : currentValue;
  textSourceMap.set(node, source);

  const translated = translateUiString(language, source);
  if (currentValue !== translated) {
    node.nodeValue = translated;
  }
};

const translateAttributes = (element: Element, language: UiLanguage): void => {
  const sourceAttributes =
    attributeSourceMap.get(element) ?? new Map<TranslatableAttribute, string>();
  attributeSourceMap.set(element, sourceAttributes);

  for (const attributeName of TRANSLATABLE_ATTRIBUTES) {
    if (!element.hasAttribute(attributeName)) continue;

    const currentValue = element.getAttribute(attributeName) ?? "";
    const previousSource = sourceAttributes.get(attributeName);
    const source =
      previousSource && isSourceOrKnownTranslation(currentValue, previousSource)
        ? previousSource
        : currentValue;
    sourceAttributes.set(attributeName, source);

    const translated = translateUiString(language, source);
    if (currentValue !== translated) {
      element.setAttribute(attributeName, translated);
    }
  }
};

const enhanceLegacyTree = (root: Element, language: UiLanguage): void => {
  translateAttributes(root, language);

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = textWalker.nextNode(); node; node = textWalker.nextNode()) {
    translateTextNode(node as Text, language);
  }

  const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let node = elementWalker.nextNode(); node; node = elementWalker.nextNode()) {
    translateAttributes(node as Element, language);
  }

  decorateLegacyResponsiveTables(root);
};

/**
 * Temporary, screen-scoped bridge for legacy modules that still render French labels or
 * responsive tables without declarative cell metadata. It must never wrap the application shell.
 */
export function LegacyDomEnhancementsBoundary(props: {
  children: ReactNode;
  language: UiLanguage;
}): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frameId = 0;
    const enhance = (): void => {
      frameId = 0;
      enhanceLegacyTree(root, props.language);
    };

    enhance();
    const observer = new MutationObserver(() => {
      if (!frameId) {
        frameId = window.requestAnimationFrame(enhance);
      }
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
      characterData: true,
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [props.language]);

  return (
    <div ref={rootRef} data-legacy-dom-enhancements="true" style={{ display: "contents" }}>
      {props.children}
    </div>
  );
}
