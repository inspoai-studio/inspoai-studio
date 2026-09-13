import React, { useState } from "react";

export const TabsUI = ({ tabs, defaultTabId, isDarkHero = false }) => {
    const [activeId, setActiveId] = useState(defaultTabId || tabs[0].id);

    return (
        <div className="flex flex-col items-center w-full">
            <div className={`inline-flex p-1.5 rounded-full border mb-8 gap-1 shadow-sm overflow-x-auto max-w-full ${isDarkHero ? 'bg-white/10 border-white/10' : 'bg-card border-border'}`}>
                {tabs.map((tab) => {
                    const isActive = activeId === tab.id;
                    return (
                        <button
                            key={tab.id}
                            className={`px-4 sm:px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                                ${isActive
                                    ? (isDarkHero ? 'bg-white text-[#1A1A2E] shadow-sm' : 'bg-black text-white shadow-sm')
                                    : (isDarkHero ? 'text-white/70 hover:text-white hover:bg-white/5' : 'text-muted-foreground hover:text-foreground hover:bg-accent')
                                }`}
                            onClick={() => setActiveId(tab.id)}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                {tabs.find((t) => t.id === activeId)?.content}
            </div>
        </div>
    );
};
