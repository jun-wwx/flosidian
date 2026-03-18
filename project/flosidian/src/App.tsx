import { useState, useEffect, useCallback, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { ViewUpdate } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { marked } from 'marked';
import { invoke } from '@tauri-apps/api/core';
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

function App() {
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [backlinks, setBacklinks] = useState<string[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes list
  const loadNotes = useCallback(async () => {
    try {
      const result = await invoke<NoteInfo[]>('list_notes');
      setNotes(result);
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }, []);

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
          const noteContent = await invoke<NoteContent>('read_note', { name: note.name });
          if (noteContent.content.includes(`[[${name}]]`)) {
            links.push(note.name);
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
    } catch (e) {
      console.error('Failed to load note:', e);
    }
  }, [notes]);

  // Save note
  const saveNote = useCallback(async (newContent: string) => {
    if (!currentNote) return;
    try {
      await invoke('save_note', { name: currentNote, content: newContent });
    } catch (e) {
      console.error('Failed to save note:', e);
    }
  }, [currentNote]);

  // Auto-save on content change
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(newContent);
    }, 3000); // Auto-save after 3 seconds
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

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
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
  }, []);

  // Load notes on mount
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Render markdown preview
  const renderPreview = () => {
    // Process [[wiki-links]]
    let processedContent = content.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
      return `<a href="#" class="wiki-link" data-note="${name}">${name}</a>`;
    });
    
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

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>NeuroNote</h2>
          <button onClick={() => setShowNewNoteDialog(true)}>+</button>
        </div>
        <div className="notes-list">
          {notes.map((note) => (
            <div
              key={note.name}
              className={`note-item ${currentNote === note.name ? 'active' : ''}`}
              onClick={() => loadNote(note.name)}
            >
              <span className="note-name">{note.name}</span>
              <button 
                className="delete-btn"
                onClick={(e) => { e.stopPropagation(); deleteNote(note.name); }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="main">
        {currentNote ? (
          <>
            <div className="toolbar">
              <span className="note-title">{currentNote}</span>
              <button onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
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
                <h3>Backlinks</h3>
                {backlinks.map((link) => (
                  <div 
                    key={link} 
                    className="backlink"
                    onClick={() => loadNote(link)}
                  >
                    {link}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="welcome">
            <h2>Welcome to NeuroNote</h2>
            <p>Select a note or create a new one to get started.</p>
            <button onClick={() => setShowNewNoteDialog(true)}>Create New Note</button>
          </div>
        )}
      </div>

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
