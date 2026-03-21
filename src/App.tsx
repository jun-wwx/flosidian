import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { ViewUpdate } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { marked } from 'marked';
import { invoke } from '@tauri-apps/api/core';
import ForceGraph2D from 'react-force-graph-2d';
import { Search, Tags, Network, Command, Sun, Moon, X, FileText, Plus, Trash2 } from 'lucide-react';
import './App.css';

interface NoteInfo {
  name: string;
  path: string;
}

interface NoteContent {
  name: string;
  content: string;
  path: string;
}

interface GraphNode {
  id: string;
  name: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

type Theme = 'light' | 'dark';

function App() {
  // Notes state
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [content, setContent] = useState('');
  
  // UI state
  const [showPreview, setShowPreview] = useState(true);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [backlinks, setBacklinks] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>('dark');
  
  // Feature: Command Palette (Ctrl+K)
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  
  // Feature: Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{name: string; matches: string[]}[]>([]);
  
  // Feature: Tags
  const [allTags, setAllTags] = useState<{name: string; count: number}[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [taggedNotes, setTaggedNotes] = useState<string[]>([]);
  
  // Feature: Graph
  const [showGraph, setShowGraph] = useState(false);
  const [graphData, setGraphData] = useState<{nodes: GraphNode[]; links: GraphLink[]}>({nodes: [], links: []});
  
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes list
  const loadNotes = useCallback(async () => {
    try {
      const result = await invoke<NoteInfo[]>('list_notes');
      setNotes(result);
      // Extract tags
      extractTags(result);
      // Build graph
      buildGraph(result);
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }, []);

  // Extract all tags from notes
  const extractTags = async (notesList: NoteInfo[]) => {
    const tagMap = new Map<string, number>();
    for (const note of notesList) {
      try {
        const noteContent = await invoke<NoteContent>('read_note', { name: note.name });
        const tagMatches = noteContent.content.match(/#[\w-]+/g) || [];
        tagMatches.forEach(tag => {
          const tagName = tag.substring(1);
          tagMap.set(tagName, (tagMap.get(tagName) || 0) + 1);
        });
      } catch (e) {
        // Skip failed notes
      }
    }
    setAllTags(Array.from(tagMap.entries()).map(([name, count]) => ({ name, count })));
  };

  // Build graph data
  const buildGraph = async (notesList: NoteInfo[]) => {
    const nodes: GraphNode[] = notesList.map(n => ({ id: n.name, name: n.name, val: 1 }));
    const links: GraphLink[] = [];
    const linkCount = new Map<string, number>();
    
    for (const note of notesList) {
      try {
        const noteContent = await invoke<NoteContent>('read_note', { name: note.name });
        const linkMatches = noteContent.content.match(/\[\[([^\]]+)\]\]/g) || [];
        linkMatches.forEach(link => {
          const target = link.match(/\[\[([^\]|]+)/)?.[1];
          if (target && notesList.some(n => n.name === target)) {
            links.push({ source: note.name, target });
            const key = [note.name, target].sort().join('---');
            linkCount.set(key, (linkCount.get(key) || 0) + 1);
          }
        });
      } catch (e) {
        // Skip
      }
    }
    
    // Update node values based on connections
    links.forEach(link => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);
      if (sourceNode) sourceNode.val += 1;
      if (targetNode) targetNode.val += 1;
    });
    
    setGraphData({ nodes, links: links.filter((l, i) => {
      const key = [l.source, l.target].sort().join('---');
      return links.findIndex(x => [x.source, x.target].sort().join('---') === key) === i;
    })});
  };

  // Load a note
  const loadNote = useCallback(async (name: string) => {
    try {
      const result = await invoke<NoteContent>('read_note', { name });
      setContent(result.content);
      setCurrentNote(name);
      
      // Find backlinks
      const links: string[] = [];
      for (const note of notes) {
        if (note.name !== name) {
          try {
            const noteContent = await invoke<NoteContent>('read_note', { name: note.name });
            if (noteContent.content.includes(`[[${name}]]`)) {
              links.push(note.name);
            }
          } catch (e) {
            // Skip
          }
        }
      }
      setBacklinks(links);
      
      // Update editor
      if (editorViewRef.current) {
        editorViewRef.current.dispatch({
          changes: { from: 0, to: editorViewRef.current.state.doc.length, insert: result.content }
        });
      }
      
      // Close panels
      setShowSearch(false);
      setShowGraph(false);
    } catch (e) {
      console.error('Failed to load note:', e);
    }
  }, [notes]);

  // Save note
  const saveNote = useCallback(async (newContent: string) => {
    if (!currentNote) return;
    try {
      await invoke('save_note', { name: currentNote, content: newContent });
      // Refresh tags and graph after save
      await loadNotes();
    } catch (e) {
      console.error('Failed to save note:', e);
    }
  }, [currentNote, loadNotes]);

  // Auto-save on content change
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(newContent);
    }, 3000);
  }, [saveNote]);

  // Create new note
  const createNote = async () => {
    if (!newNoteName.trim()) return;
    try {
      await invoke('create_note', { name: newNoteName.trim() });
      setShowNewNoteDialog(false);
      setNewNoteName('');
      await loadNotes();
      await loadNote(newNoteName.trim());
    } catch (e) {
      console.error('Failed to create note:', e);
    }
  };

  // Delete note
  const deleteNote = async (name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await invoke('delete_note', { name });
      if (currentNote === name) {
        setCurrentNote(null);
        setContent('');
      }
      await loadNotes();
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  };

  // Search notes
  const searchNotes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    const results: {name: string; matches: string[]}[] = [];
    for (const note of notes) {
      try {
        const noteContent = await invoke<NoteContent>('read_note', { name: note.name });
        const lowerQuery = query.toLowerCase();
        if (note.name.toLowerCase().includes(lowerQuery) || 
            noteContent.content.toLowerCase().includes(lowerQuery)) {
          // Find matching lines
          const lines = noteContent.content.split('\n');
          const matches = lines.filter(l => l.toLowerCase().includes(lowerQuery)).slice(0, 3);
          results.push({ name: note.name, matches });
        }
      } catch (e) {
        // Skip
      }
    }
    setSearchResults(results);
  }, [notes]);

  // Handle tag click
  const handleTagClick = async (tagName: string) => {
    setSelectedTag(tagName);
    const tagged: string[] = [];
    for (const note of notes) {
      try {
        const noteContent = await invoke<NoteContent>('read_note', { name: note.name });
        if (noteContent.content.includes(`#${tagName}`)) {
          tagged.push(note.name);
        }
      } catch (e) {
        // Skip
      }
    }
    setTaggedNotes(tagged);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowSearch(false);
        setShowGraph(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        theme === 'dark' ? oneDark : [],
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            handleContentChange(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [theme]);

  // Load notes on mount
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Theme effect on editor
  useEffect(() => {
    if (editorViewRef.current) {
      const newState = EditorState.create({
        doc: editorViewRef.current.state.doc.toString(),
        extensions: [
          basicSetup,
          markdown(),
          theme === 'dark' ? oneDark : [],
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
              handleContentChange(update.state.doc.toString());
            }
          }),
          EditorView.lineWrapping,
        ],
      });
      editorViewRef.current.setState(newState);
    }
  }, [theme, handleContentChange]);

  // Render markdown preview
  const renderPreview = () => {
    let processedContent = content
      // Process wiki-links
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, name, alias) => {
        return `<a href="#" class="wiki-link" data-note="${name}">${alias}</a>`;
      })
      .replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
        return `<a href="#" class="wiki-link" data-note="${name}">${name}</a>`;
      })
      // Process tags
      .replace(/#([\w-]+)/g, '<span class="tag">#$1</span>');
    
    return { __html: marked(processedContent) as string };
  };

  // Handle wiki-link click
  const handlePreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      e.preventDefault();
      const noteName = target.getAttribute('data-note');
      if (noteName) {
        loadNote(noteName);
      }
    }
  };

  // Filter notes by tag
  const displayedNotes = selectedTag ? notes.filter(n => taggedNotes.includes(n.name)) : notes;

  // Command palette commands
  const commands = useMemo(() => [
    { id: 'new-note', label: 'New Note', icon: Plus, action: () => { setShowNewNoteDialog(true); setShowCommandPalette(false); } },
    { id: 'search', label: 'Search Notes', icon: Search, action: () => { setShowSearch(true); setShowCommandPalette(false); } },
    { id: 'graph', label: 'Open Graph View', icon: Network, action: () => { setShowGraph(true); setShowCommandPalette(false); } },
    { id: 'tags', label: 'View Tags', icon: Tags, action: () => { setSelectedTag(null); setShowCommandPalette(false); } },
    { id: 'toggle-theme', label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme', icon: theme === 'dark' ? Sun : Moon, action: () => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setShowCommandPalette(false); } },
  ], [theme, taggedNotes]);

  const filteredCommands = commandQuery 
    ? commands.filter(c => c.label.toLowerCase().includes(commandQuery.toLowerCase()))
    : commands;

  return (
    <div className={`app ${theme}`}>
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>NeuroNote</h2>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setShowSearch(true)} title="Search">
              <Search size={16} />
            </button>
            <button className="icon-btn" onClick={() => setShowGraph(true)} title="Graph">
              <Network size={16} />
            </button>
            <button className="icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="icon-btn" onClick={() => setShowNewNoteDialog(true)} title="New Note">
              <Plus size={16} />
            </button>
          </div>
        </div>
        
        {/* Tags section */}
        <div className="tags-section">
          <div className="tags-header">
            <Tags size={14} />
            <span>Tags</span>
          </div>
          <div className="tags-list">
            {allTags.slice(0, 10).map(tag => (
              <span 
                key={tag.name} 
                className={`tag-item ${selectedTag === tag.name ? 'active' : ''}`}
                onClick={() => handleTagClick(tag.name)}
              >
                #{tag.name} ({tag.count})
              </span>
            ))}
          </div>
        </div>
        
        {/* Notes list */}
        <div className="notes-list">
          {displayedNotes.map((note) => (
            <div
              key={note.name}
              className={`note-item ${currentNote === note.name ? 'active' : ''}`}
              onClick={() => loadNote(note.name)}
            >
              <FileText size={14} className="note-icon" />
              <span className="note-name">{note.name}</span>
              <button 
                className="delete-btn"
                onClick={(e) => { e.stopPropagation(); deleteNote(note.name); }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        
        {/* Command hint */}
        <div className="command-hint">
          <Command size={12} /> Press Ctrl+K for commands
        </div>
      </div>

      {/* Main content */}
      <div className="main">
        {/* Graph View */}
        {showGraph && (
          <div className="graph-overlay">
            <div className="graph-header">
              <h3>Knowledge Graph</h3>
              <button onClick={() => setShowGraph(false)}><X size={20} /></button>
            </div>
            <ForceGraph2D
              graphData={graphData}
              nodeLabel="name"
              nodeColor={() => theme === 'dark' ? '#6cb6ff' : '#0969da'}
              linkColor={() => theme === 'dark' ? '#444' : '#ccc'}
              backgroundColor={theme === 'dark' ? '#1e1e1e' : '#ffffff'}
              width={800}
              height={500}
              onNodeClick={(node) => loadNote(node.id)}
            />
          </div>
        )}
        
        {currentNote ? (
          <>
            <div className="toolbar">
              <span className="note-title">{currentNote}</span>
              <div className="toolbar-actions">
                <button onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
              </div>
            </div>
            <div className="editor-container">
              <div className="editor" ref={editorRef}></div>
              {showPreview && (
                <div 
                  className="preview" 
                  dangerouslySetInnerHTML={renderPreview()}
                  onClick={handlePreviewClick}
                ></div>
              )}
            </div>
            {/* Backlinks panel */}
            {backlinks.length > 0 && (
              <div className="backlinks">
                <h3>Backlinks ({backlinks.length})</h3>
                {backlinks.map((link) => (
                  <div 
                    key={link} 
                    className="backlink"
                    onClick={() => loadNote(link)}
                  >
                    <FileText size={12} /> {link}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="welcome">
            <h2>Welcome to NeuroNote</h2>
            <p>Select a note or create a new one to get started.</p>
            <div className="welcome-features">
              <div className="feature"><Search size={16} /> Search notes (Ctrl+K)</div>
              <div className="feature"><Network size={16} /> View knowledge graph</div>
              <div className="feature"><Tags size={16} /> Use #tags in notes</div>
            </div>
            <button onClick={() => setShowNewNoteDialog(true)}>Create New Note</button>
          </div>
        )}
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="search-panel">
          <div className="search-header">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); searchNotes(e.target.value); }}
              autoFocus
            />
            <button onClick={() => setShowSearch(false)}><X size={18} /></button>
          </div>
          <div className="search-results">
            {searchResults.map(result => (
              <div key={result.name} className="search-result" onClick={() => loadNote(result.name)}>
                <div className="result-name">{result.name}</div>
                {result.matches.map((match, i) => (
                  <div key={i} className="result-match">...{match}...</div>
                ))}
              </div>
            ))}
            {searchQuery && searchResults.length === 0 && (
              <div className="no-results">No results found</div>
            )}
          </div>
        </div>
      )}

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="command-palette-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Type a command..."
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              autoFocus
            />
            <div className="commands-list">
              {filteredCommands.map(cmd => (
                <div key={cmd.id} className="command-item" onClick={cmd.action}>
                  <cmd.icon size={16} />
                  <span>{cmd.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New note dialog */}
      {showNewNoteDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>New Note</h3>
            <input
              type="text"
              placeholder="Note name"
              value={newNoteName}
              onChange={(e) => setNewNoteName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createNote()}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={() => setShowNewNoteDialog(false)}>Cancel</button>
              <button onClick={createNote}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
