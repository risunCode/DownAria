/**
 * Text Parser Utility
 * Auto-hyperlink URLs and @mentions in text
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXTwitter, faInstagram, faFacebook, faTiktok, faYoutube } from '@fortawesome/free-brands-svg-icons';

interface ParsedSegment {
  type: 'text' | 'url' | 'mention' | 'hashtag';
  content: string;
  url?: string;
}

// Platform configs for mentions with FontAwesome icons
const MENTION_PLATFORMS = [
  { key: 'twitter', name: 'X (Twitter)', icon: faXTwitter, color: '#000000', getUrl: (u: string) => `https://x.com/${u}` },
  { key: 'instagram', name: 'Instagram', icon: faInstagram, color: '#E4405F', getUrl: (u: string) => `https://instagram.com/${u}` },
  { key: 'facebook', name: 'Facebook', icon: faFacebook, color: '#1877F2', getUrl: (u: string) => `https://facebook.com/${u}` },
  { key: 'tiktok', name: 'TikTok', icon: faTiktok, color: '#000000', getUrl: (u: string) => `https://tiktok.com/@${u}` },
  { key: 'youtube', name: 'YouTube', icon: faYoutube, color: '#FF0000', getUrl: (u: string) => `https://youtube.com/@${u}` },
];

// Platform configs for hashtag search
const HASHTAG_PLATFORMS = [
  { key: 'twitter', name: 'X (Twitter)', icon: faXTwitter, color: '#000000', getUrl: (tag: string) => `https://x.com/search?q=%23${tag}` },
  { key: 'instagram', name: 'Instagram', icon: faInstagram, color: '#E4405F', getUrl: (tag: string) => `https://instagram.com/explore/tags/${tag}` },
  { key: 'facebook', name: 'Facebook', icon: faFacebook, color: '#1877F2', getUrl: (tag: string) => `https://facebook.com/hashtag/${tag}` },
  { key: 'tiktok', name: 'TikTok', icon: faTiktok, color: '#000000', getUrl: (tag: string) => `https://tiktok.com/tag/${tag}` },
  { key: 'youtube', name: 'YouTube', icon: faYoutube, color: '#FF0000', getUrl: (tag: string) => `https://youtube.com/results?search_query=%23${tag}` },
];

/**
 * Parse text and extract URLs, mentions, hashtags
 */
export function parseText(text: string): ParsedSegment[] {
  if (!text) return [];
  
  const segments: ParsedSegment[] = [];
  const pattern = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+)|(@[\w.]+)|(#[\w\u4e00-\u9fff]+)/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    
    const [fullMatch, urlMatch, mentionMatch, hashtagMatch] = match;
    
    if (urlMatch) {
      let url = urlMatch;
      if (url.startsWith('www.')) url = 'https://' + url;
      segments.push({ type: 'url', content: urlMatch, url });
    } else if (mentionMatch) {
      segments.push({ type: 'mention', content: mentionMatch, url: mentionMatch.slice(1) });
    } else if (hashtagMatch) {
      segments.push({ type: 'hashtag', content: hashtagMatch });
    }
    
    lastIndex = match.index + fullMatch.length;
  }
  
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  
  return segments;
}

// Dropdown menu rendered via portal
function MentionDropdown({ 
  username, 
  position, 
  onClose 
}: { 
  username: string; 
  position: { top: number; left: number; openUp?: boolean; openLeft?: boolean }; 
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Close on scroll (fixes dropdown moving with scroll)
    const handleScroll = () => onClose();
    
    // Delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEsc);
      window.addEventListener('scroll', handleScroll, true); // capture phase for nested scrolls
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);
  
  const openProfile = (getUrl: (u: string) => string) => {
    window.open(getUrl(username), '_blank', 'noopener,noreferrer');
    onClose();
  };
  
  if (!mounted) return null;
  
  return createPortal(
    <div 
      ref={menuRef}
      style={{ 
        position: 'fixed',
        top: position.openUp ? 'auto' : position.top, 
        bottom: position.openUp ? `${window.innerHeight - position.top + 4}px` : 'auto',
        left: position.openLeft ? 'auto' : position.left,
        right: position.openLeft ? `${window.innerWidth - position.left}px` : 'auto',
        zIndex: 99999,
        minWidth: '180px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      <div style={{ 
        padding: '8px 12px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
          Open <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>@{username}</span> on:
        </p>
      </div>
      <div style={{ padding: '4px 0' }}>
        {MENTION_PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => openProfile(p.getUrl)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: '14px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FontAwesomeIcon icon={p.icon} style={{ width: '18px', height: '18px', color: p.color }} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

// Separate component for mention to handle its own state
function MentionLink({ username, content }: { username: string; content: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, openUp: false, openLeft: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 280; // approximate dropdown height
      const menuWidth = 200; // approximate dropdown width
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.left;
      const openUp = spaceBelow < menuHeight;
      const openLeft = spaceRight < menuWidth;
      
      setMenuPos({
        top: openUp ? rect.top : rect.bottom + 4,
        left: openLeft ? rect.right : rect.left,
        openUp,
        openLeft,
      });
    }
    setShowMenu(!showMenu);
  };
  
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="text-[var(--accent-primary)] hover:underline cursor-pointer font-medium"
        onClick={handleClick}
      >
        {content}
      </button>
      
      {showMenu && (
        <MentionDropdown 
          username={username} 
          position={menuPos} 
          onClose={() => setShowMenu(false)} 
        />
      )}
    </>
  );
}

// Dropdown menu for hashtag search via portal
function HashtagDropdown({ 
  hashtag, 
  position, 
  onClose 
}: { 
  hashtag: string; 
  position: { top: number; left: number; openUp?: boolean; openLeft?: boolean }; 
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Close on scroll (fixes dropdown moving with scroll)
    const handleScroll = () => onClose();
    
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEsc);
      window.addEventListener('scroll', handleScroll, true);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);
  
  const searchHashtag = (getUrl: (tag: string) => string) => {
    window.open(getUrl(hashtag), '_blank', 'noopener,noreferrer');
    onClose();
  };
  
  if (!mounted) return null;
  
  return createPortal(
    <div 
      ref={menuRef}
      style={{ 
        position: 'fixed',
        top: position.openUp ? 'auto' : position.top, 
        bottom: position.openUp ? `${window.innerHeight - position.top + 4}px` : 'auto',
        left: position.openLeft ? 'auto' : position.left,
        right: position.openLeft ? `${window.innerWidth - position.left}px` : 'auto',
        zIndex: 99999,
        minWidth: '180px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      <div style={{ 
        padding: '8px 12px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
          Search <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>#{hashtag}</span> on:
        </p>
      </div>
      <div style={{ padding: '4px 0' }}>
        {HASHTAG_PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => searchHashtag(p.getUrl)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              fontSize: '14px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--text-primary)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FontAwesomeIcon icon={p.icon} style={{ width: '18px', height: '18px', color: p.color }} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

// Separate component for hashtag to handle its own state
function HashtagLink({ hashtag, content }: { hashtag: string; content: string }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, openUp: false, openLeft: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 280;
      const menuWidth = 200; // approximate dropdown width
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.left;
      const openUp = spaceBelow < menuHeight;
      const openLeft = spaceRight < menuWidth;
      
      setMenuPos({
        top: openUp ? rect.top : rect.bottom + 4,
        left: openLeft ? rect.right : rect.left,
        openUp,
        openLeft,
      });
    }
    setShowMenu(!showMenu);
  };
  
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="text-[var(--accent-secondary)] hover:underline cursor-pointer font-medium"
        onClick={handleClick}
      >
        {content}
      </button>
      
      {showMenu && (
        <HashtagDropdown 
          hashtag={hashtag} 
          position={menuPos} 
          onClose={() => setShowMenu(false)} 
        />
      )}
    </>
  );
}

interface RichTextProps {
  text: string;
  platform?: string;
  className?: string;
  maxLength?: number;
}

/**
 * Render text with clickable links and mentions
 */
export function RichText({ text, className = '', maxLength }: RichTextProps) {
  if (!text) return null;
  
  const displayText = maxLength && text.length > maxLength 
    ? text.slice(0, maxLength) + '...' 
    : text;
  
  const segments = parseText(displayText);
  
  return (
    <span className={className}>
      {segments.map((segment, idx) => {
        switch (segment.type) {
          case 'url':
            return (
              <a
                key={idx}
                href={segment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-primary)] hover:underline break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {segment.content}
              </a>
            );
          
          case 'mention':
            return (
              <MentionLink 
                key={idx} 
                username={segment.url || ''} 
                content={segment.content} 
              />
            );
          
          case 'hashtag':
            return (
              <HashtagLink 
                key={idx} 
                hashtag={segment.content.slice(1)} 
                content={segment.content} 
              />
            );
          
          default:
            return <span key={idx}>{segment.content}</span>;
        }
      })}
    </span>
  );
}

export default RichText;
