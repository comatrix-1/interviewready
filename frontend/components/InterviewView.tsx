
import React, { useState, useRef, useEffect } from 'react';
import { InterviewMessage } from '../types';
import { Send, User, Bot, XCircle } from 'lucide-react';

interface Props {
  history: InterviewMessage[];
  onSend: (msg: string) => void;
  onClose: () => void;
  loading: boolean;
}

const InterviewView: React.FC<Props> = ({ history, onSend, onClose, loading }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[700px] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-500">
      <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="font-bold">Interviewer Agent</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Simulation Active</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <XCircle size={24} />
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 custom-scrollbar"
      >
        {history.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2`}
          >
            <div className={`max-w-[80%] flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === 'assistant' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
              </div>
              <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                msg.role === 'assistant' ? 'bg-white text-slate-800' : 'bg-indigo-600 text-white'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-200 w-32 h-10 rounded-2xl"></div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your answer here..."
          className="flex-1 px-5 py-3 bg-slate-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
        />
        <button 
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default InterviewView;
