import { useState, useCallback, useRef } from "react";
import { streamChat } from "../lib/streamChat";
import { friendlyToolLabel } from "../lib/toolLabels";

const API_URL = import.meta.env.VITE_API_URL;

function getSessionId() {
  let id = localStorage.getItem("delve_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("delve_session_id", id);
  }
  return id;
}

const newSession = useCallback(() => {
  localStorage.removeItem("delve_session_id");
  setMessages([]);
  setSources([]);
  setStatus(null);
  setPendingClarification(null);
}, []);


export function useChat() {
  const [messages, setMessages] = useState([]);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState(null);
  const [pendingClarification, setPendingClarification] = useState(null);
  const [busy, setBusy] = useState(false);
 // const pendingInput = useRef({});

  const runStream = useCallback((url, body) => {
    setBusy(true);
    setStatus(null);

    return streamChat({
      url,
      body,
      handlers: {
        onToolStart: (d) => {
          setStatus(friendlyToolLabel(d.tool));
          //  if (d.tool === "extract_info" && d.input?.paper_id) {
          //     //  pendingInput.current[d.tool] = d.input;
          //         pendingInput.current[d.input.paperId] = d.input;
          //  }
        },
        onToolEnd: (d) => {
          if (d.tool !== "extract_info") return;

          try {
            

            let paperJson;

            const parsed = JSON.parse(d.output);
            if (Array.isArray(parsed) && parsed[0]?.text){
              paperJson = JSON.parse(parsed[0].text);
            }
            else{
              paperJson = parsed;   // direct format
            }
            // const paperId = d.input?.paper_id;
            // if (!paperId || !paperJson.title) return;
            
            const papers = paperJson.papers || []; 

            setSources((prev) =>{
              // prev.some((s) => s.paper_id === paperId)
              //   ? prev
              //   : [...prev, { paper_id: paperId, ...paperJson }]
               const updatedSources = [...prev];
               papers.forEach((paper) => {
                if (paper.paper_id && paper.title && !updatedSources.some((s) => s.paper_id === paper.paper_id)) {
                  updatedSources.push({
                    paper_id: paper.paper_id,
                    title: paper.title,
                    authors: paper.authors,
                    summary: paper.summary,
                    pdf_url: paper.pdf_url,
                    published: paper.published
                  });
                }
              });
              return updatedSources;
            }
            );
          } catch (e){
            console.error("extract_info parse error:", e, "output:", d.output);
            // not parseable — skip, non-fatal
          }
        },
        onInterrupt: (d) => {
          setPendingClarification(d);
          setStatus(null);
          setBusy(false);
        },
        onDone: (d) => {
          setMessages((prev) => [...prev, { role: "assistant", content: d.answer ,traceId: d.trace_id}]);
          // setSources((prev) => {
          //   const cited = new Set((d.answer.match(/\d{4}\.\d{4,5}(v\d+)?/g) || []));
          //   return prev.filter((s) => cited.has(s.paper_id));
          // });
          const citedIds = new Set(d.cited_paper_ids || []);
          //setSources((prev) => prev.filter((s) => citedIds.has(s.paper_id)));
          setSources((prev) => {
            const merged = [...prev];
            for (const p of d.fetched_papers || []) {
              if (p.paper_id && !merged.some((s) => s.paper_id === p.paper_id)) {
                merged.push(p);
              }
            }
            return merged.filter((s) => citedIds.has(s.paper_id));
          });
          
          setStatus(null);
          setBusy(false);
        },
        onError: (e) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Something went wrong: ${e.message}` },
          ]);
          setStatus(null);
          setBusy(false);
        },
      },
    });
  }, []);

  const send = useCallback(
    (query) => {
      setMessages((prev) => [...prev, { role: "user", content: query }]);
      setSources([]);
      return runStream(`${API_URL}/chat`, { query, session_id: getSessionId() });
    },
    [runStream]
  );

  const resume = useCallback(
    (answer) => {
      const session_id = pendingClarification?.session_id;
      setPendingClarification(null);
      setMessages((prev) => [...prev, { role: "user", content: answer }]);
      setSources([]);
      return runStream(`${API_URL}/resume`, { session_id: session_id, answer });
    },
    [runStream,pendingClarification]
  );
  const sendFeedback = useCallback((traceId, isPositive) => {
    return fetch(`${API_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trace_id: traceId, is_positive: isPositive }),
    });
  }, []);

  return { messages, sources, status, pendingClarification, busy, send, resume, sendFeedback, newSession };
  // return { messages, sources, status, pendingClarification, busy, send, resume };
}