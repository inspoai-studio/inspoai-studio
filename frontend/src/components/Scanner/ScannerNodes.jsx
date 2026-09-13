import React from 'react';
import { Handle, Position } from 'reactflow';
import {
    Phone,
    Search,
    Palette,
    Type,
    Code2,
    DollarSign,
    Mail,
    Globe,
    Network,
    Twitter,
    Linkedin,
    Instagram,
    Facebook,
    ExternalLink,
    Image as ImageIcon,
    Target,
    Rocket
} from 'lucide-react';
import '../../styles/BrandScanner.css';

/* -------------------------------------------------------------------------- */
/*                                CUSTOM NODES                                */
/* -------------------------------------------------------------------------- */

export const WebsiteNode = ({ data }) => (
    <div className="brand-node website-node">
        <Handle type="source" position={Position.Bottom} className="handle-dot" />
        <Handle type="source" position={Position.Top} className="handle-dot" />
        <Handle type="source" position={Position.Right} className="handle-dot" />
        <Handle type="source" position={Position.Left} className="handle-dot" />

        <div className="site-preview" style={{ position: 'relative' }}>
            {data.screenshot ? (
                <img src={data.screenshot} alt="Site Preview" className="site-screenshot" />
            ) : (
                <div style={{ width: '100%', height: '100%', background: '#f1f5f9' }} />
            )}
        </div>
        <div className="site-meta">
            <div className="site-title flex-center" style={{ marginBottom: 4 }}>
                {data.logo && <img src={data.logo} alt="Logo" style={{ width: 22, height: 22, borderRadius: 4, marginRight: 8 }} />}
                <span className="truncate" style={{ fontWeight: 700, fontSize: '0.95rem' }}>{data.label}</span>
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-gray-400 hover-blue">
                    <ExternalLink size={16} />
                </a>
            </div>
            <div className="site-desc" style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>{data.description}</div>
        </div>
    </div>
);

export const ColorNode = ({ data }) => (
    <div className="brand-node color-node">
        <Handle type="target" position={Position.Bottom} />
        <div className="node-header-st">
            <Palette size={14} className="text-indigo-500" style={{ marginRight: 8 }} />
            Brand Colors
        </div>
        <div className="palette-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {data.colors && data.colors.map((color, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                        width: 18,
                        height: 18,
                        backgroundColor: color,
                        borderRadius: 3,
                        border: '1px solid rgba(0,0,0,0.05)'
                    }} />
                    <span style={{ fontSize: '0.75rem', color: '#475569', fontFamily: 'monospace' }}>{color}</span>
                </div>
            ))}
        </div>
    </div>
);

export const FontNode = ({ data }) => (
    <div className="brand-node font-node">
        <Handle type="target" position={Position.Left} />
        <div className="node-header-st">
            <Type size={14} className="text-pink-500" style={{ marginRight: 8 }} />
            Typography
        </div>
        <div className="font-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.fonts && data.fonts.slice(0, 4).map((font, i) => (
                <div key={i} className="font-item">
                    <div className="font-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span className="font-name" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{font.name || font}</span>
                        {font.category && <span className="font-cat" style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>{font.category}</span>}
                    </div>
                    <div className="font-sample" style={{
                        fontFamily: font.fullStack || font.name || font,
                        fontSize: '1rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        Abc Hello World
                    </div>
                    {font.weights && (
                        <div className="font-weights" style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {font.weights.slice(0, 3).map(w => <span key={w} style={{ fontSize: '0.6rem', background: '#f8fafc', color: '#64748b', padding: '1px 4px', borderRadius: 3 }}>{w}</span>)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
);

export const TechNode = ({ data }) => {
    const order = { 'Platform': 1, 'Hosting': 2, 'Payment': 3, 'API': 4, 'Library': 5 };
    const stack = (data.stack || []).map(item => {
        if (typeof item === 'string') return { name: item, type: 'Library' };
        return item;
    }).sort((a, b) => (order[a.type] || 99) - (order[b.type] || 99));

    return (
        <div className="brand-node tech-node" style={{ minWidth: 260 }}>
            <Handle type="target" position={Position.Top} />
            <div className="node-header-st">
                <Code2 size={14} className="text-blue-500" style={{ marginRight: 8 }} />
                Infrastructure
            </div>
            <div className="tech-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stack.slice(0, 15).map((tech, i) => (
                    <div key={i} className={`infra-pill type-${tech.type}`} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px' }}>
                        <span>{tech.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const PricingNode = ({ data }) => (
    <div className="brand-node pricing-node">
        <Handle type="target" position={Position.Right} />
        <div className="node-header-st">
            <DollarSign size={14} className="text-green-500" style={{ marginRight: 8 }} />
            Pricing Structure
        </div>
        <div className="pricing-grid" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.plans && data.plans.length > 0 ? (
                data.plans.slice(0, 4).map((plan, i) => (
                    <div key={i} className="pricing-mini-card" style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600 }}>{plan.name}</span>
                            <span style={{ color: '#059669', fontWeight: 600 }}>{plan.price}</span>
                        </div>
                    </div>
                ))
            ) : (
                <div style={{ padding: 8, fontSize: '0.8rem' }} className="text-gray-400 italic">
                    {data.hasPricing ? 'Limited data extracted.' : 'No plans found.'}
                </div>
            )}
        </div>
    </div>
);

export const ContactNode = ({ data }) => {
    const SocialIcon = ({ type, size = 14 }) => {
        switch (type.toLowerCase()) {
            case 'twitter': case 'x': return <Twitter size={size} />;
            case 'linkedin': return <Linkedin size={size} />;
            case 'instagram': return <Instagram size={size} />;
            case 'facebook': return <Facebook size={size} />;
            default: return <Globe size={size} />;
        }
    };

    return (
        <div className="brand-node contact-node">
            <Handle type="target" position={Position.Right} />
            <div className="node-header-st">
                <Mail size={14} className="text-orange-500" style={{ marginRight: 8 }} />
                Contacts & Social
            </div>
            <div className="contact-list">
                {data.emails && data.emails.slice(0, 2).map((email, i) => (
                    <div key={i} className="contact-item">
                        <Mail size={12} style={{ opacity: 0.5 }} />
                        <a href={`mailto:${email}`} className="truncate" style={{ color: '#2563eb', textDecoration: 'none' }}>{email}</a>
                    </div>
                ))}
                {data.phones && data.phones.slice(0, 2).map((phone, i) => (
                    <div key={i} className="contact-item">
                        <Phone size={12} style={{ opacity: 0.5 }} />
                        <span>{phone}</span>
                    </div>
                ))}
            </div>
            {data.social && Object.keys(data.social).length > 0 && (
                <div className="social-row">
                    {Object.entries(data.social).slice(0, 6).map(([platform, url]) => (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="social-icon" title={platform}>
                            <SocialIcon type={platform} />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export const AssetsNode = ({ data }) => (
    <div className="brand-node assets-node" style={{ width: 500 }}>
        <Handle type="target" position={Position.Left} />
        <div className="node-header-st" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <ImageIcon size={14} className="text-purple-500" style={{ marginRight: 8 }} />
                Visual Assets ({data.images?.length || 0})
            </div>
            {data.onOpenModal && (
                <button
                    onClick={() => data.onOpenModal(data.images)}
                    style={{ border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                >
                    View All
                </button>
            )}
        </div>
        <div className="assets-grid">
            {data.images && data.images.slice(0, 12).map((img, i) => (
                <div key={i} className="asset-item" onClick={() => data.onOpenModal && data.onOpenModal(data.images, i)}>
                    <img src={img} alt={`Asset ${i}`} />
                </div>
            ))}
        </div>
    </div>
);

export const LogoNode = ({ data }) => (
    <div className="brand-node logo-node" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16 }}>
        <Handle type="target" position={Position.Right} />
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Brand Identity
        </div>
        <div className="logo-container" style={{
            width: 100,
            height: 100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#fff',
            border: 'none',
            padding: 10
        }}>
            {data.logo ? (
                <img src={data.logo} alt="Brand Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
                <div style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>No Logo</div>
            )}
        </div>
    </div>
);

export const SubdomainNode = ({ data }) => (
    <div className="brand-node subdomain-node" style={{ width: 280, background: '#fff' }}>
        <Handle type="target" position={Position.Right} />
        <div className="node-header-st">
            <Network size={14} className="text-teal-500" style={{ marginRight: 8 }} />
            Discovered Subdomains
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px' }}>
            {data.subdomains && data.subdomains.length > 0 ? (
                data.subdomains.slice(0, 8).map((sub, i) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: '#334155', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                        <Globe size={10} color="#94a3b8" style={{ marginRight: 6 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
                    </div>
                ))
            ) : (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No subdomains found</div>
            )}
        </div>
    </div>
);

export const SEONode = ({ data }) => (
    <div className="brand-node seo-node" style={{ minWidth: 260 }}>
        <Handle type="target" position={Position.Top} />
        <div className="node-header-st">
            <Globe size={14} className="text-teal-500" style={{ marginRight: 8 }} />
            SEO & Meta
        </div>
        <div className="seo-content" style={{ padding: '4px 0', fontSize: '0.8rem' }}>
            {data.meta?.sitemap && (
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 4 }}>SITEMAP</div>
                    <a href={data.meta.sitemap} target="_blank" rel="noopener noreferrer" className="truncate block" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                        {data.meta.sitemap}
                    </a>
                </div>
            )}
            <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 4 }}>DESCRIPTION</div>
            <div style={{ lineHeight: 1.4, opacity: 0.8 }}>{data.description?.slice(0, 100)}...</div>
        </div>
    </div>
);

export const BuiltWithNode = ({ data }) => (
    <div className="brand-node builtwith-node" style={{ minWidth: 260 }}>
        <Handle type="target" position={Position.Top} />
        <div className="node-header-st">
            <Code2 size={14} style={{ marginRight: 8 }} />
            Built With
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {data.platforms?.map((p, i) => (
                <span key={i} style={{
                    padding: '6px 14px',
                    borderRadius: 10,
                    background: '#f0fdf4',
                    color: '#15803d',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid #bbf7d0',
                    whiteSpace: 'nowrap'
                }}>
                    {p}
                </span>
            ))}
            {(!data.platforms || data.platforms.length === 0) && (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Unknown CMS</span>
            )}
        </div>
    </div>
);

export const CompetitorSingleNode = ({ data }) => (
    <div className="brand-node competitor-single-node" style={{ width: 220, padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <Handle type="target" position={Position.Top} className="handle-dot" />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                {data.logo ? (
                    <img src={data.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                    <Globe size={16} className="text-gray-400" />
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="truncate block" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', textDecoration: 'none' }}>
                    {(data.url || "").replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                </a>
                <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Competitor
                </div>
            </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4, marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            {data.meta}
        </div>
    </div>
);

export const ICPNode = ({ data }) => {
    const icpList = data.icp || [];
    return (
        <div className="brand-node icp-node" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Handle type="target" position={Position.Top} />
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, background: '#e0e7ff', color: '#4f46e5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Target size={16} />
                </div>
                <div>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Audience Segments</div>
                    <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 800 }}>Target Audience (ICP)</div>
                </div>
            </div>
            <div className="icp-table" style={{ display: 'flex', flexDirection: 'row', padding: '12px', gap: '12px' }}>
                {Array.isArray(icpList) && icpList.map((segment, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 180, maxWidth: 220, borderRight: i === icpList.length - 1 ? 'none' : '1px solid #e2e8f0', paddingRight: i === icpList.length - 1 ? 0 : 12 }}>

                        {/* Target Industry */}
                        <div>
                            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Target Industry</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                <span style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0f172a', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, border: '1px solid #bae6fd' }}>
                                    {segment.industry || "Unknown"}
                                </span>
                            </div>
                        </div>

                        {/* Target Roles */}
                        <div>
                            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Target Roles</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {Array.isArray(segment.roles) && segment.roles.map((role, idx) => (
                                    <span key={idx} style={{ padding: '4px 8px', background: '#e0f2fe', color: '#0f172a', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, border: '1px solid #bae6fd' }}>
                                        {role}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Core Use Case */}
                        <div>
                            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Core Use Case</div>
                            <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.4 }}>
                                {segment.useCase}
                            </div>
                        </div>

                    </div>
                ))}
            </div>
        </div>
    );
};

export const ToolNode = ({ data }) => {
    return (
        <div className="brand-node tool-node" style={{ background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflow: 'hidden', minWidth: 300, maxWidth: 350 }}>
            <Handle type="target" position={Position.Top} />
            <div style={{ padding: '12px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Rocket size={16} color="#16a34a" />
                <div style={{ fontSize: '0.85rem', color: '#14532d', fontWeight: 800 }}>{data.name}</div>
            </div>
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '0.75rem', color: '#166534', lineHeight: 1.4, marginBottom: 12 }}>{data.description}</div>
                <div style={{ background: '#eff6ff', padding: '10px', borderRadius: 6 }}>
                    <div style={{ fontSize: '0.65rem', color: '#1e3a8a', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>SEO Indexing Benefit:</div>
                    <div style={{ fontSize: '0.7rem', color: '#1e40af', lineHeight: 1.4 }}>{data.seoBenefit}</div>
                </div>
            </div>
        </div>
    );
};

export const KeywordNode = ({ data }) => {
    return (
        <div className="brand-node keyword-node" style={{ background: '#f5f3ff', borderRadius: 8, border: '1px solid #ddd6fe', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflow: 'hidden', minWidth: 280, maxWidth: 320, padding: '12px 16px' }}>
            <Handle type="target" position={Position.Top} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <Search size={14} color="#8b5cf6" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#5b21b6', background: '#ede9fe', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                    {data.keyword}
                </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#4c1d95', lineHeight: 1.4, marginLeft: 24 }}>{data.reason}</div>
        </div>
    );
};

export const GrowthHeaderNode = ({ data }) => {
    return (
        <div className="brand-node header-node" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', overflow: 'hidden', minWidth: 250, border: `2px solid ${data.color || '#e2e8f0'}` }}>
            <Handle type="target" position={Position.Top} />
            <div style={{ background: data.bgColor || '#f8fafc', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, background: '#fff', color: data.color || '#1e293b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)' }}>
                    {data.icon === 'rocket' ? <Rocket size={20} /> : <Search size={20} />}
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: data.color || '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{data.subtitle}</div>
                    <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>{data.title}</div>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
};

export const nodeTypes = {
    website: WebsiteNode,
    colors: ColorNode,
    fonts: FontNode,
    tech: TechNode,
    pricing: PricingNode,
    logo: LogoNode,
    contacts: ContactNode,
    assets: AssetsNode,
    seo: SEONode,
    builtwith: BuiltWithNode,
    competitorSingle: CompetitorSingleNode,
    icp: ICPNode,
    toolNode: ToolNode,
    keywordNode: KeywordNode,
    growthHeader: GrowthHeaderNode,
    subdomains: SubdomainNode
};
