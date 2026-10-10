import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, X, Loader } from "lucide-react";

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
}

export function SupportBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "bot",
      content:
        "Hi! 👋 I'm the craftframework support assistant. Ask me about setup, features, or report bugs. What can I help you with?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/.netlify/functions/support-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          email: userEmail || undefined,
          context: window.location.pathname,
        }),
      });

      const data = await response.json();

      let botResponse = "";
      if (data.answer) {
        botResponse = data.answer;
      } else {
        botResponse =
          data.message ||
          "Thanks for your message! The team will review it shortly.";
      }

      if (data.issueCreated && data.issueUrl) {
        botResponse += `\n\n[Track your issue on GitHub](${data.issueUrl})`;
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: botResponse,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);

      if (
        data.type === "bug" ||
        data.type === "feature" ||
        (data.type === "question" && !data.answer)
      ) {
        if (!userEmail) {
          setTimeout(() => {
            const followUp: Message = {
              id: (Date.now() + 2).toString(),
              type: "bot",
              content:
                "Could you share your email so we can follow up with you? (Optional)",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, followUp]);
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content:
          "Sorry, I encountered an error. Please try again or contact support at craftframework@becomechange.institute",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Widget Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-40 hover:scale-110"
        aria-label="Open support chat"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[90vw] h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg">
            <h3 className="font-semibold">craftframework Support</h3>
            <p className="text-sm opacity-90">Ask questions or report issues</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg ${
                    msg.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-800 border border-gray-200"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <a
                    href="#"
                    className={`text-xs mt-1 block ${
                      msg.type === "user"
                        ? "text-blue-100 hover:text-white"
                        : "text-blue-600 hover:text-blue-800"
                    }`}
                  >
                    {msg.type === "bot" &&
                      msg.content.includes("[Track") &&
                      "View issue"}
                  </a>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 border border-gray-200 px-3 py-2 rounded-lg">
                  <Loader className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Email Input (optional) */}
          {!userEmail && messages.length > 2 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-white">
              <input
                type="email"
                placeholder="Your email (optional)"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200 p-4 bg-white rounded-b-lg"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or describe an issue..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              📧 Contact us at{" "}
              <a
                href="mailto:craftframework@becomechange.institute"
                className="text-blue-600 hover:underline"
              >
                craftframework@becomechange.institute
              </a>
            </p>
          </form>
        </div>
      )}
    </>
  );
}
