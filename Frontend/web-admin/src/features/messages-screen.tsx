import { useMemo, useState } from "react";

import type { ScreenId } from "../shared/types/app";
import { useI18n } from "../shared/i18n-context";

type MessageBubble = {
  id: string;
  author: string;
  body: string;
  mine?: boolean;
  role: string;
  timeLabel: string;
};

type MessageThread = {
  id: string;
  audience: string;
  channelLabel: string;
  lastPreview: string;
  participants: number;
  priority: string;
  timeLabel: string;
  title: string;
  unreadCount: number;
  messages: MessageBubble[];
};

type MessagesScreenProps = {
  currentRoleLabel: string;
  onSelectScreen: (screen: ScreenId) => void;
};

const THREADS: MessageThread[] = [
  {
    id: "thread-1",
    title: "Admissions 2025-2026",
    audience: "Scolarite",
    channelLabel: "Canal interne",
    lastPreview: "Verifier la liste finale des dossiers avant impression.",
    participants: 6,
    priority: "Priorite haute",
    timeLabel: "2 min",
    unreadCount: 3,
    messages: [
      {
        id: "thread-1-message-1",
        author: "Awa Diallo",
        role: "Scolarite",
        body: "Peux-tu verifier la liste finale des dossiers de la 6e A avant midi ?",
        timeLabel: "09:12"
      },
      {
        id: "thread-1-message-2",
        author: "GestSchool V2",
        role: "Coordination",
        body: "Le lot de 18 inscriptions est pret pour validation et emission des fiches.",
        timeLabel: "09:17"
      },
      {
        id: "thread-1-message-3",
        author: "Vous",
        role: "Administration",
        body: "Je relis la liste puis je lance la verification croisee avec les classes.",
        timeLabel: "09:24",
        mine: true
      }
    ]
  },
  {
    id: "thread-2",
    title: "Relances comptabilite",
    audience: "Comptabilite",
    channelLabel: "Recouvrement",
    lastPreview: "Le niveau 4e B depasse le seuil d'encours a surveiller.",
    participants: 4,
    priority: "Suivi journalier",
    timeLabel: "12 min",
    unreadCount: 1,
    messages: [
      {
        id: "thread-2-message-1",
        author: "Comptabilite",
        role: "Finance",
        body: "Le niveau 4e B depasse le seuil d'encours a surveiller.",
        timeLabel: "08:44"
      },
      {
        id: "thread-2-message-2",
        author: "Vous",
        role: "Administration",
        body: "Je bascule l'equipe sur une relance prioritaire apres le point du jour.",
        timeLabel: "08:51",
        mine: true
      }
    ]
  },
  {
    id: "thread-3",
    title: "Bulletins T2",
    audience: "Pedagogie",
    channelLabel: "Notes & bulletins",
    lastPreview: "Les bulletins de la 3e C attendent encore une validation enseignant.",
    participants: 8,
    priority: "Validation",
    timeLabel: "35 min",
    unreadCount: 2,
    messages: [
      {
        id: "thread-3-message-1",
        author: "Vie scolaire",
        role: "Pilotage",
        body: "Les bulletins de la 3e C attendent encore une validation enseignant.",
        timeLabel: "07:55"
      },
      {
        id: "thread-3-message-2",
        author: "Scolarite centrale",
        role: "Scolarite",
        body: "Les PDF sont deja generes, il manque seulement l'accord final pour publier.",
        timeLabel: "08:02"
      },
      {
        id: "thread-3-message-3",
        author: "Vous",
        role: "Administration",
        body: "On garde ce canal comme point unique jusqu'a publication complete.",
        timeLabel: "08:09",
        mine: true
      }
    ]
  }
];

function getThreadInitials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function MessagesScreen(props: MessagesScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const { currentRoleLabel, onSelectScreen } = props;
  const [activeThreadId, setActiveThreadId] = useState(THREADS[0]?.id ?? "");

  const activeThread = useMemo(
    () => THREADS.find((thread) => thread.id === activeThreadId) ?? THREADS[0],
    [activeThreadId]
  );
  const unreadCount = THREADS.reduce((total, thread) => total + thread.unreadCount, 0);
  const conversationCount = THREADS.length;
  const participantCount = THREADS.reduce((total, thread) => total + thread.participants, 0);
  const messageCount = THREADS.reduce((total, thread) => total + thread.messages.length, 0);

  return (
    <>
      <section className="panel table-panel workflow-section module-modern messages-hero">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Messagerie interne")}</p>
            <h2>{tr("Communication d'equipe (apercu gele)")}</h2>
          </div>
          <span className="module-header-badge">{currentRoleLabel}</span>
        </div>
        <div className="notice-card notice-warning" role="status">
          <strong>{tr("Garde-fou Lot 0")}</strong>
          <p>
            {tr("Ce module est volontairement marque UI-only : les fils ci-dessous sont des exemples locaux,\n            aucun message n'est persiste et aucun backend messagerie n'est branche pour le moment.")}</p>
        </div>
        <p className="section-lead">
          {tr("Inbox equipe, lecture des priorites, fil actif et zone de composition deja cadres dans une\n          interface premium. Le branchement metier et l'envoi reel restent geles jusqu'a arbitrage.")}</p>
        <div className="module-overview-grid">
          <article className="module-overview-card">
            <span>{tr("Conversations")}</span>
            <strong>{conversationCount}</strong>
            <small>{tr("Espaces de travail actifs")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Messages")}</span>
            <strong>{messageCount}</strong>
            <small>{tr("Historique demo non persiste")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Non lus")}</span>
            <strong>{unreadCount}</strong>
            <small>{tr("Priorites immediates")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Participants")}</span>
            <strong>{participantCount}</strong>
            <small>{tr("Canaux equipes metier")}</small>
          </article>
        </div>
        <div className="module-inline-strip">
          <span className="module-inline-pill">{tr("Vue inbox premium")}</span>
          <span className="module-inline-pill">{tr("Canaux finances / scolarite / bulletins")}</span>
          <span className="module-inline-pill">{tr("Lot 0: UI-only, backend absent")}</span>
        </div>
      </section>

      <section className="messages-layout">
        <article className="panel table-panel workflow-section module-modern messages-list-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">{tr("Boite principale")}</p>
              <h2>{tr("Conversations")}</h2>
            </div>
            <span className="module-header-badge">{unreadCount} {tr("non lus")}</span>
          </div>
          <div className="messages-thread-summary">
            <span>{conversationCount} {tr("fil(s) actifs")}</span>
            <span>{tr("Priorisation immediate")}</span>
            <span>{tr("Canaux metier centralises")}</span>
          </div>
          <div className="messages-thread-list">
            {THREADS.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`message-thread-card ${
                  thread.id === activeThread.id ? "is-active" : ""
                }`.trim()}
                onClick={() => setActiveThreadId(thread.id)}
              >
                <div className="message-thread-topline">
                  <div className="message-thread-identity">
                    <span className="message-thread-avatar" aria-hidden="true">
                      {getThreadInitials(thread.title)}
                    </span>
                    <div className="message-thread-copy">
                      <strong>{thread.title}</strong>
                      <small>{thread.audience}</small>
                    </div>
                  </div>
                  <span className="message-thread-time">{thread.timeLabel}</span>
                </div>
                <p>{thread.lastPreview}</p>
                <div className="message-thread-meta">
                  <span>{thread.channelLabel}</span>
                  <span>{thread.priority}</span>
                  {thread.unreadCount > 0 ? (
                    <span className="message-thread-badge">{thread.unreadCount}</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="panel editor-panel workflow-section module-modern messages-conversation-panel">
          <div className="table-header">
            <div>
              <p className="section-kicker">{tr("Fil actif")}</p>
              <h2>{activeThread.title}</h2>
            </div>
            <span className="module-header-badge">{activeThread.channelLabel}</span>
          </div>
          <div className="messages-conversation-toolbar">
            <div className="messages-conversation-meta">
              <span>{activeThread.participants} {tr("participant(s)")}</span>
              <span>{activeThread.priority}</span>
              <span>{activeThread.audience}</span>
            </div>
            <span className="messages-conversation-status">
              {activeThread.messages.length} {tr("message(s) dans ce fil")}</span>
          </div>
          <div className="messages-conversation-stream">
            <div className="messages-bubble-list">
              {activeThread.messages.map((message) => (
                <article
                  key={message.id}
                  className={`message-bubble ${message.mine ? "is-mine" : ""}`.trim()}
                >
                  <div className="message-bubble-head">
                    <strong>{message.author}</strong>
                    <span>{message.role}</span>
                  </div>
                  <p>{message.body}</p>
                  <small>{message.timeLabel}</small>
                </article>
              ))}
            </div>
          </div>
          <div className="messages-compose-card">
            <div className="messages-compose-copy">
              <strong>{tr("Zone de composition prete")}</strong>
              <p>
                {tr("Le module est cree pour la v2. On branchera ensuite l'envoi, les canaux, les pieces\n                jointes et les regles metier.")}</p>
            </div>
            <div className="messages-compose-editor">
              <textarea
                disabled
                placeholder={tr("Zone de saisie verrouillee en attendant le branchement backend et les regles metier.")}
              />
              <div className="messages-compose-hints">
                <span>{tr("Pieces jointes a venir")}</span>
                <span>{tr("Canaux et droits par role")}</span>
                <span>{tr("Historique auditables")}</span>
              </div>
            </div>
            <div className="messages-compose-actions">
              <button
                type="button"
                className="button-ghost"
                onClick={() => onSelectScreen("schoolLifeNotifications")}
              >
                {tr("Ouvrir les notifications")}</button>
              <button type="button" disabled>
                {tr("Envoi bientot disponible")}</button>
            </div>
          </div>
        </article>

        <aside className="messages-side">
          <article className="panel table-panel workflow-section module-modern messages-side-card">
            <div className="table-header">
              <div>
                <p className="section-kicker">{tr("Regles du module")}</p>
                <h2>{tr("Cadre de la v2")}</h2>
              </div>
            </div>
            <div className="module-inline-stack">
              <span className="module-inline-pill">{tr("Inbox equipe")}</span>
              <span className="module-inline-pill">{tr("Priorisation des fils")}</span>
              <span className="module-inline-pill">{tr("Historique lisible")}</span>
              <span className="module-inline-pill">{tr("Branchement metier apres validation")}</span>
            </div>
          </article>

          <article className="panel table-panel workflow-section module-modern messages-side-card">
            <div className="table-header">
              <div>
                <p className="section-kicker">{tr("Raccourcis lies")}</p>
                <h2>{tr("Continuer le workflow")}</h2>
              </div>
            </div>
            <div className="messages-side-actions">
              <button type="button" className="button-ghost" onClick={() => onSelectScreen("students")}>
                {tr("Ouvrir les eleves")}</button>
              <button type="button" className="button-ghost" onClick={() => onSelectScreen("finance")}>
                {tr("Aller a la finance")}</button>
              <button type="button" className="button-ghost" onClick={() => onSelectScreen("grades")}>
                {tr("Revoir les bulletins")}</button>
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
