import { useState, useEffect } from 'react';
import { FaPalette, FaFont, FaLightbulb, FaThLarge } from 'react-icons/fa';
import "../../styles/AISuggestions.css";

export default function AISuggestions({ aiSuggestions, colorPalette }) {
  const [loadedFonts, setLoadedFonts] = useState(new Set());

  // Simple function to load Google Fonts dynamically
  const loadGoogleFont = (fontName) => {
    if (!fontName || loadedFonts.has(fontName)) return;

    try {
      // Format font name for URL (replace spaces with +)
      const formattedFontName = fontName.replace(/\s+/g, '+');

      // Create link element
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${formattedFontName}:wght@400;700&display=swap`;
      link.rel = 'stylesheet';

      // Append to document head
      document.head.appendChild(link);

      // Update loaded fonts set
      setLoadedFonts(prev => new Set([...prev, fontName]));
    } catch (error) {
      console.error(`Error loading font ${fontName}:`, error);
    }
  };

  // Parse the AI suggestions into structured sections
  const parseAISuggestions = (aiText) => {
    if (!aiText) return [];

    const sections = [];

    // Split by h1 tags to get sections
    const sectionParts = aiText.split('<h1>');

    for (let i = 1; i < sectionParts.length; i++) {
      const part = sectionParts[i];
      const titleEnd = part.indexOf('</h1>');

      if (titleEnd === -1) continue;

      const title = part.substring(0, titleEnd).trim();
      const content = part.substring(titleEnd + 5).trim();

      let sectionConfig = null;
      let items = [];

      // Determine section type based on title
      if (title.toLowerCase().includes('color palette')) {
        sectionConfig = {
          id: 'color',
          title: title,
          icon: <img src='./icons/Color.svg' alt="Color Palette" className="section-icon" />,
          type: 'swatch'
        };

        // Extract color items
        const lines = content.split('\n');
        lines.forEach(line => {
          if (line.trim().startsWith('-')) {
            const itemText = line.replace('-', '').trim();
            const colorMatch = itemText.match(/(.+?):\s*(#[A-Fa-f0-9]{6})\s*\((.+?)\)/);
            if (colorMatch) {
              items.push({
                label: colorMatch[1].trim(),
                value: colorMatch[2],
                bg: colorMatch[2],
                description: colorMatch[3]
              });
            }
          }
        });
      }
      else if (title.toLowerCase().includes('typography')) {
        sectionConfig = {
          id: 'typography',
          title: title,
          icon: <img src='./icons/Typo.svg' alt="Color Palette" className="section-icon" />,
          type: 'font'
        };

        // Extract font items
        const lines = content.split('\n');
        lines.forEach(line => {
          if (line.match(/^\d+\./)) {
            const itemText = line.replace(/^\d+\./, '').trim();
            const fontMatch = itemText.match(/(.+?)\s*\((.+?)\)\s*-\s*(.+)/);
            if (fontMatch) {
              // Get just the font name without additional styles
              const fontName = fontMatch[1].trim().split(',')[0].trim();

              // Load this font from Google Fonts
              loadGoogleFont(fontName);

              items.push({
                label: fontName,
                style: { fontFamily: `"${fontName}", sans-serif` },
                subtitle: fontMatch[2],
                usage: fontMatch[3]
              });
            } else if (itemText) {
              // Simpler format
              const fontName = itemText.split(' ')[0].trim();

              // Load this font from Google Fonts
              loadGoogleFont(fontName);

              items.push({
                label: fontName,
                style: { fontFamily: `"${fontName}", sans-serif` },
                subtitle: 'Headline (Bold 500)'
              });
            }
          }
        });
      }
      else if (title.toLowerCase().includes('brand inspiration')) {
        sectionConfig = {
          id: 'inspiration',
          title: title,
          icon: <img src='./icons/Brand.svg' alt="Color Palette" className="section-icon" />,
          type: 'text'
        };

        // Extract brand items from numbered list
        const lines = content.split('\n');
        lines.forEach(line => {
          if (line.match(/^\d+\./)) {
            const itemText = line.replace(/^\d+\./, '').trim();
            if (itemText) {
              // Parse "Brand Name - description" format
              const parts = itemText.split(' - ');
              if (parts.length >= 2) {
                items.push({
                  heading: parts[0].trim(),
                  description: parts[1].trim()
                });
              } else {
                // Alternative format: "Brand Name for description"
                const forMatch = itemText.match(/^([^-]+?)\s+for\s+(.+)$/);
                if (forMatch) {
                  items.push({
                    heading: forMatch[1].trim(),
                    description: forMatch[2].trim()
                  });
                } else {
                  // Fallback: just use the whole text
                  items.push({
                    heading: itemText,
                    description: ''
                  });
                }
              }
            }
          }
        });
      }
      else if (title.toLowerCase().includes('layout')) {
        sectionConfig = {
          id: 'layout',
          title: title,
          icon: <img src='./icons/layout.svg' alt="Color Palette" className="section-icon" />,
          type: 'text'
        };

        // Extract layout items
        const lines = content.split('\n');
        lines.forEach(line => {
          if (line.match(/^\d+\./)) {
            const itemText = line.replace(/^\d+\./, '').trim();
            if (itemText) {
              // Parse "Layout Type - description" format
              const parts = itemText.split(' - ');
              if (parts.length >= 2) {
                items.push({
                  heading: parts[0].trim(),
                  description: parts[1].trim()
                });
              } else {
                items.push({
                  heading: itemText,
                  description: ''
                });
              }
            }
          }
        });
      }

      if (sectionConfig && items.length > 0) {
        sections.push({
          ...sectionConfig,
          items: items
        });
      }
    }

    return sections;
  };

  const sections = parseAISuggestions(aiSuggestions);

  if (!sections.length) {
    return null;
  }

  return (
    <div className="ai-suggestion">
      {/* Sidebar */}
      <aside className="sidebar1">
        <div className="timeline-line" />
        {sections.map(sec => (
          <div key={sec.id} className="timeline-item">
            <div className="timeline-icon">{sec.icon}</div>
          </div>
        ))}
      </aside>

      {/* Main */}
      <main className="content">
        {sections.map(sec => (
          <section key={sec.id} className="section-block">
            <header className="section-header">
              <h2 className="section-title">{sec.title}</h2>
            </header>
            <div className="cards-grid">
              {sec.items.slice(0, 5).map((item, i) => (
                <div key={i} className={`card ${sec.type}-card`}>
                  {/* Text items with heading and description */}
                  {sec.type === 'text' && (
                    <>
                      <div className="card-title">
                        {item.heading || item}
                      </div>
                      <div className="card-text">
                        {item.description || ''}
                      </div>
                    </>
                  )}

                  {/* Color Swatch */}
                  {sec.type === 'swatch' && (
                    <>
                      <div
                        className="card-swatch"
                        style={{ backgroundColor: item.bg }}
                      />
                      <div className="card-title">{item.label}</div>
                      <div className="card-value">{item.value}</div>
                      <div className="card-text">
                        {item.description || 'Lorem ipsum is placeholder text commonly used in the graphic, print, and publishing industries for previewing layouts and visual mockups.'}
                      </div>
                    </>
                  )}

                  {/* Typography - Now with actual Google Font rendering */}
                  {sec.type === 'font' && (
                    <>
                      <div
                        className="card-title"
                        style={item.style}
                      >
                        {item.label}
                      </div>
                      <div className="card-subtitle">{item.subtitle || 'Headline (Bold 500)'}</div>
                      <div
                        className="card-text"
                        style={item.style}
                      >
                        {item.usage || 'Lorem ipsum is placeholder text commonly used in the graphic, print, and publishing industries for previewing layouts and visual mockups.'}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}