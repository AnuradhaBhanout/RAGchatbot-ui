import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState ,useEffect} from "react";
import { useChat } from "./hooks/useChat";
import "./App.css";

const RESEARCH_URL = "https://ragchatbot-research.onrender.com"

const STARTER_PROMPTS = [
  "Summarize recent papers on RAG evaluation",
  "Show me a claim you can't verify and refuse to answer",
  "What's new in retrieval-augmented generation?",
];

export default function App() {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sources, status, pendingClarification, busy, send, resume } = useChat();

  useEffect(() => {
    fetch('${import.meta.env.VITE_API_URL}/health').catch(() => {});
    fetch('${RESEARCH_URL}/health').catch(() => {});
  },[]);

  const hasMessages = messages.length > 0;
  const hasSources = sources.length > 0;

function handleSend() {
  const query = input.trim();
  if (!query || busy) return;
  setInput("");

  if (pendingClarification) {
    resume(query);
  } else {
    send(query);
  }
}
  return (
    <>
      <div className="scene" />

      <div className="shell">
        <header className="topbar glass">
            <span className="brand">Footnote<span className="tagline">every answer, sourced or refused</span></span>
          <button
            className="evidence-toggle"
            onClick={() => setEvidenceOpen(!evidenceOpen)}
          >
            Sources · {sources.length}
          </button>
        </header>

        <div className="layout">
          <main className="thread">
            {hasMessages ? (
              <>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`bubble ${m.role === "user" ? "bubble-user glass-accent" : "bubble-assistant glass"}`}
                  >
                    {(<ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>)}
                  </div>
                ))}
                {status && <div className="status">{status}</div>}
              </>
            ) : (
              <div className="empty-state">
                <h1 className="empty-title">Ask. We'll verify every citation.</h1>
                <p className="empty-subtitle">
                  Ask a question and Footnote will search, verify every citation against the source,
                  and refuse to answer if it can't confirm one.
                </p>
                <div className="prompt-chips">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      className="prompt-chip glass"
                      onClick={() => send(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pendingClarification && (
              <div className="bubble bubble-assistant glass clarify">
                <p>{pendingClarification.question}</p>
                {pendingClarification.options?.length > 0 && (
                  <div className="clarify-options">
                    {pendingClarification.options.map((opt) => (
                      <button key={opt} onClick={() => resume(opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <footer className="composer glass">
              <input
                className="composer-input"
                placeholder="Ask about your papers..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={busy}
              />
              <button className="composer-send" onClick={handleSend} disabled={busy}>
                {busy ? "..." : "Send"}
              </button>
            </footer>
          </main>

          <aside className={`evidence glass ${evidenceOpen ? "open" : ""}`}>
            <h2 className="evidence-title">Evidence</h2>

            {hasSources ? (
              sources.map((s, i) => (
                <div className="source-card" key={s.paper_id || i}>
                  <span className="source-badge">✓ verified</span>
                  <h3>{s.title}</h3>
                  <p className="source-meta">{Array.isArray(s.authors) ? s.authors.join(", ") : s.authors} · {s.published}</p>
                </div>
              ))
            ) : (
              <div className="evidence-empty">
                <p>No sources yet</p>
                <span>Papers you retrieve will show up here, with citation verification.</span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}