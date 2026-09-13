import { useState, useEffect } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { Copy, Check, RefreshCw, Type, AlignLeft, Hash } from "lucide-react";
export default function LoremIpsumGen() {
  const [type, setType] = useState("paragraphs");
  const [count, setCount] = useState(3);
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [generatedText, setGeneratedText] = useState("");
  const [copied, setCopied] = useState(false);
  const loremDictionary = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate", "velit", "esse", "cillum", "dolore", "eu", "fugiat", "nulla", "pariatur", "excepteur", "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id", "est", "laborum"];
  useEffect(() => {
    generateText();
  }, [type, count, startWithLorem]);
  const randomWord = () => loremDictionary[Math.floor(Math.random() * loremDictionary.length)];
  const generateSentence = (isFirstSentence = false) => {
    const wordCount = Math.floor(Math.random() * 8) + 6; // 6 to 13 words
    let sentence = [];
    for (let i = 0; i < wordCount; i++) {
      sentence.push(randomWord());
    }
    if (isFirstSentence && startWithLorem) {
      sentence[0] = "Lorem";
      sentence[1] = "ipsum";
      sentence[2] = "dolor";
      sentence[3] = "sit";
      sentence[4] = "amet,";
    } else {
      sentence[0] = sentence[0].charAt(0).toUpperCase() + sentence[0].slice(1);
    }

    // Add some random commas occasionally
    if (wordCount > 8 && Math.random() > 0.6) {
      const commaIndex = Math.floor(wordCount / 2);
      if (!sentence[commaIndex].endsWith(',')) {
        sentence[commaIndex] = sentence[commaIndex] + ",";
      }
    }
    return sentence.join(" ") + ".";
  };
  const generateParagraph = (isFirst = false) => {
    const sentenceCount = Math.floor(Math.random() * 4) + 4; // 4 to 7 sentences
    let paragraph = [];
    for (let i = 0; i < sentenceCount; i++) {
      paragraph.push(generateSentence(isFirst && i === 0));
    }
    return paragraph.join(" ");
  };
  const generateText = () => {
    let result = "";
    const limitCount = Math.min(Math.max(1, count), type === "words" ? 1000 : 100); // Sanity limits
    setCount(limitCount);
    if (type === "words") {
      let words = [];
      for (let i = 0; i < limitCount; i++) {
        words.push(randomWord());
      }
      if (startWithLorem && limitCount >= 5) {
        words[0] = "Lorem";
        words[1] = "ipsum";
        words[2] = "dolor";
        words[3] = "sit";
        words[4] = "amet";
      } else {
        words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      }
      result = words.join(" ") + ".";
    } else if (type === "sentences") {
      let sentences = [];
      for (let i = 0; i < limitCount; i++) {
        sentences.push(generateSentence(i === 0));
      }
      result = sentences.join(" ");
    } else if (type === "paragraphs") {
      let paragraphs = [];
      for (let i = 0; i < limitCount; i++) {
        paragraphs.push(generateParagraph(i === 0));
      }
      // Join with double newline for markdown/display separation
      result = paragraphs.join("\n\n");
    }
    setGeneratedText(result);
  };
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "Lorem Ipsum Generator by Inspo AI",
      "applicationCategory": "DesignApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }, {
      "@type": "FAQPage",
      "mainEntity": [{
        "@type": "Question",
        "name": "What is Lorem Ipsum?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Lorem Ipsum is simply dummy text of the printing and typesetting industry. It has been the industry's standard dummy text ever since the 1500s."
        }
      }, {
        "@type": "Question",
        "name": "Can I generate specific amounts of text?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, you can choose to generate text based on the number of paragraphs, sentences, or individual words. Adjust the count input to get exactly the amount you need for your mockup."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="Lorem Ipsum Generator" relatedTools={[{
    name: "PX to REM Converter",
    href: "/free-tools/px-to-rem-converter"
  }, {
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }]}>
            <SEO title="Free Lorem Ipsum Generator | Dummy Text Maker | Inspo AI" description="Generate readable, professional Lorem Ipsum placeholder text instantly. Customize by paragraphs, words, or sentences for your design mockups." keywords="lorem ipsum generator, dummy text generator, placeholder text maker, lorem ipsum words paragraphs" schemaMarkup={schemaMarkup} />

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Lorem Ipsum <span className="inspo-gradient-text">Generator</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Instantly generate professional placeholder text for your mockups and wireframes. Customize the length and format exactly as you need.
                    </p>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-inspo overflow-hidden flex flex-col">

                    {/* Controls Toolbar */}
                    <div className="p-6 md:p-8 border-b border-border bg-secondary/30 flex flex-col md:flex-row gap-6 items-center justify-between">

                        {/* Type Selection */}
                        <div className="w-full md:w-auto flex bg-secondary border border-border rounded-xl p-1 shrink-0">
                            <button onClick={() => setType("paragraphs")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none justify-center ${type === "paragraphs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                <AlignLeft size={16} /> Paragraphs
                            </button>
                            <button onClick={() => setType("sentences")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none justify-center ${type === "sentences" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                <Type size={16} /> Sentences
                            </button>
                            <button onClick={() => setType("words")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none justify-center ${type === "words" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                                <Hash size={16} /> Words
                            </button>
                        </div>

                        {/* Amount & Options */}
                        <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-6">
                            <div className="flex items-center gap-3 bg-background border border-border px-3 py-1.5 rounded-xl">
                                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pl-1 font-mono">Count</span>
                                <input type="number" min="1" max="100" value={count} onChange={e => setCount(Number(e.target.value))} className="w-16 bg-secondary text-center text-foreground p-1.5 rounded-md outline-none font-mono font-bold" />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${startWithLorem ? 'bg-primary border-primary' : 'bg-transparent border-border group-hover:border-primary/50'}`}>
                                    {startWithLorem && <Check size={14} className="text-primary-foreground" />}
                                </div>
                                <input type="checkbox" checked={startWithLorem} onChange={e => setStartWithLorem(e.target.checked)} className="hidden" />
                                <span className="text-sm font-medium text-foreground whitespace-nowrap">Start with "Lorem ipsum"</span>
                            </label>
                        </div>
                    </div>

                    {/* Output Area */}
                    <div className="relative bg-background">
                        <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
                            <button onClick={generateText} className="bg-secondary/80 backdrop-blur-sm border border-border hover:bg-secondary text-foreground p-2.5 rounded-xl transition-all shadow-sm group" aria-label="Regenerate" title="Regenerate random text">
                                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                            </button>
                            <button onClick={copyToClipboard} className="bg-foreground text-background hover:bg-foreground/90 px-4 py-2.5 rounded-xl font-medium transition-all shadow-md flex items-center gap-2">
                                {copied ? <><Check size={18} className="text-green-400" /> Copied</> : <><Copy size={18} /> Copy Text</>}
                            </button>
                        </div>

                        <div className="p-8 lg:p-12 min-h-[400px] max-h-[600px] overflow-y-auto">
                            <div className="prose prose-lg dark:prose-invert max-w-none font-body text-foreground/90 selection:bg-primary/20">
                                {generatedText.split('\n\n').map((paragraph, i) => <p key={i} className="mb-6 last:mb-0 leading-relaxed">{paragraph}</p>)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </FreeToolLayout>;
}