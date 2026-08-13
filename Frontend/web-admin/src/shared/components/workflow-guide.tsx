import { Children, ReactNode, cloneElement, isValidElement } from "react";

import { useI18n } from "../i18n-context";
import type { WorkflowStepDef } from "../types/app";

type WorkflowGuideProps = {
  title: string;
  steps: WorkflowStepDef[];
  activeStepId: string;
  onStepChange: (stepId: string) => void;
  children: ReactNode;
  className?: string;
};

type WorkflowNavigationProps = Pick<
  WorkflowGuideProps,
  "title" | "steps" | "activeStepId" | "onStepChange"
>;

export function WorkflowNavigation({
  title,
  steps,
  activeStepId,
  onStepChange
}: WorkflowNavigationProps): JSX.Element | null {
  const { t } = useI18n();
  const activeStep = steps.find((step) => step.id === activeStepId) || steps[0];

  if (!activeStep || steps.length <= 1) return null;

  return (
    <div className={`workflow-navigation ${steps.length > 4 ? "has-many-steps" : ""}`.trim()}>
      <label className="workflow-step-select">
        <span>{t("Étape du parcours")}</span>
        <select
          value={activeStep.id}
          aria-label={t("Choisir une étape")}
          onChange={(event) => onStepChange(event.target.value)}
        >
          {steps.map((step) => (
            <option key={step.id} value={step.id}>
              {t(step.title)}
            </option>
          ))}
        </select>
        {activeStep.hint ? <small>{t(activeStep.hint)}</small> : null}
      </label>
      <div className="workflow-tabs" role="tablist" aria-label={t(title)}>
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={step.id === activeStep.id}
            className={`workflow-tab ${step.id === activeStep.id ? "is-active" : ""}`.trim()}
            onClick={() => onStepChange(step.id)}
          >
            {t(step.title)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkflowGuide(props: WorkflowGuideProps): JSX.Element {
  const { title, steps, activeStepId, onStepChange, children, className } = props;
  const activeStep = steps.find((step) => step.id === activeStepId) || steps[0];

  const walk = (currentNode: ReactNode): ReactNode =>
    Children.map(currentNode, (node) => {
      if (!isValidElement(node)) return node;

      const currentProps = node.props as {
        children?: ReactNode;
        className?: string;
        ["data-step-id"]?: string;
      };

      const nestedChildren = walk(currentProps.children);
      const stepId = currentProps["data-step-id"];
      const isStepNode = typeof stepId === "string" && stepId.length > 0;

      if (!isStepNode) {
        if (nestedChildren !== currentProps.children) {
          return cloneElement(node, { children: nestedChildren });
        }
        return node;
      }

      const isActive = stepId === activeStep.id;
      const className = [currentProps.className, isActive ? "workflow-step-active" : "workflow-hidden"]
        .filter(Boolean)
        .join(" ");

      return cloneElement(node, {
        className,
        "aria-hidden": !isActive,
        "data-active-step": isActive ? "true" : "false",
        children: nestedChildren
      });
    });

  const managedChildren = walk(children);

  return (
    <section className={["workflow-shell workflow-shell-compact", className].filter(Boolean).join(" ")}>
      <WorkflowNavigation
        title={title}
        steps={steps}
        activeStepId={activeStep.id}
        onStepChange={onStepChange}
      />
      <div className="workflow-body">{managedChildren}</div>
    </section>
  );
}
