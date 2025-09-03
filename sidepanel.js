document.addEventListener('DOMContentLoaded', () => {
    // Initialize the extension
    initTabs();
    initTheme();
    loadSavedNotes();
    
    // Button event listeners - only add if elements exist
    const summarizeBtn = document.getElementById('summarizeBtn');
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    const clearNotesBtn = document.getElementById('clearNotesBtn');
    const refreshNotesBtn = document.getElementById('refreshNotesBtn');
    
    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', summarizeSelectedText);
    }
    
    if (saveNotesBtn) {
        saveNotesBtn.addEventListener('click', saveNotes);
    }
    
    if (clearNotesBtn) {
        clearNotesBtn.addEventListener('click', clearNotes);
    }
    
    if (refreshNotesBtn) {
        refreshNotesBtn.addEventListener('click', loadSavedNotes);
    }
});

// Tab functionality
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show active tab pane
            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Theme toggle functionality
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    
    if (!themeToggle) return;
    
    // Load saved theme preference
    chrome.storage.local.get(['darkTheme'], function(result) {
        if (result.darkTheme) {
            document.body.classList.add('dark-theme');
            themeToggle.textContent = '☀️';
        }
    });
    
    // Toggle theme on button click
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDarkTheme = document.body.classList.contains('dark-theme');
        
        // Save theme preference
        chrome.storage.local.set({ darkTheme: isDarkTheme });
        
        // Update button icon
        themeToggle.textContent = isDarkTheme ? '☀️' : '🌙';
    });
}

// Get selected text from current tab and summarize it
async function summarizeSelectedText() {
    // Show loading state
    const summarizeBtn = document.getElementById('summarizeBtn');
    if (!summarizeBtn) return;
    
    const originalText = summarizeBtn.innerHTML;
    summarizeBtn.innerHTML = '<span class="spinner"></span> Summarizing...';
    summarizeBtn.disabled = true;
    
    try {
        // Query the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Execute script to get selected text
        const [{ result: selectedText }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getSelectedText
        });

        if (!selectedText || selectedText.trim().length < 50) {
            throw new Error('Please select more text to summarize (at least 50 characters)');
        }

        // Use a free summarization API (Hugging Face Inference API)
        const summarizedText = await callSummarizationAPI(selectedText);
        showResult(summarizedText);
        showToast('Text summarized successfully!', 'success');

    } catch (error) {
        showResult('Error: ' + error.message);
        showToast('Failed to summarize text', 'error');
        console.error('Summarization error:', error);
    } finally {
        // Restore button state
        summarizeBtn.innerHTML = originalText;
        summarizeBtn.disabled = false;
    }
}

// Function to get selected text (executed in the context of the web page)
function getSelectedText() {
    return window.getSelection().toString();
}

// Call the summarization API
async function callSummarizationAPI(text) {
    // For demonstration purposes, we'll use a simple algorithm-based summarization
    // In a real extension, you would use a proper API
    
    // This is a mock implementation that simulates API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simple algorithm to create a summary (for demonstration only)
    // In a real extension, replace this with an actual API call
    const sentences = text.split('. ');
    if (sentences.length <= 3) {
        return text; // Text is already short
    }
    
    // Select the first, middle and last sentences for the summary
    const summary = [
        sentences[0],
        sentences[Math.floor(sentences.length / 2)],
        sentences[sentences.length - 1]
    ].join('. ') + '.';
    
    return summary;
}

// Save note to storage
function saveNotes() {
    const notesTextarea = document.getElementById('notes');
    if (!notesTextarea) return;
    
    const newNote = notesTextarea.value.trim();
    if (!newNote) {
        showToast('Please write something before saving!', 'warning');
        return;
    }

    chrome.storage.local.get(['researchNotes'], function(result) {
        let notesArray = Array.isArray(result.researchNotes) ? result.researchNotes : [];
        
        // Add timestamp to note
        const noteWithTimestamp = {
            content: newNote,
            date: new Date().toISOString()
        };
        
        notesArray.push(noteWithTimestamp);

        chrome.storage.local.set({ researchNotes: notesArray }, function() {
            showToast('Note saved successfully!', 'success');
            notesTextarea.value = ''; // clear textarea
            loadSavedNotes(); // update display
            
            // Switch to saved notes tab
            const savedTabBtn = document.querySelector('[data-tab="saved"]');
            if (savedTabBtn) savedTabBtn.click();
        });
    });
}

// Clear notes textarea
function clearNotes() {
    const notesTextarea = document.getElementById('notes');
    if (!notesTextarea) return;
    
    if (notesTextarea.value.trim() && 
        confirm('Are you sure you want to clear your note?')) {
        notesTextarea.value = '';
        showToast('Note cleared', 'success');
    }
}

// Load all saved notes and display
function loadSavedNotes() {
    chrome.storage.local.get(['researchNotes'], function(result) {
        const notesContainer = document.getElementById('allNotesList');
        if (!notesContainer) return;
        
        const notesArray = Array.isArray(result.researchNotes) ? result.researchNotes : [];
        
        if (notesArray.length === 0) {
            notesContainer.innerHTML = '<div class="placeholder">No saved notes yet...</div>';
            return;
        }
        
        notesContainer.innerHTML = ''; // clear previous notes
        
        // Reverse to show newest first
        notesArray.reverse().forEach((note, index) => {
            const noteCard = document.createElement('div');
            noteCard.className = 'note-card';
            
            // Format date
            const date = new Date(note.date);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            noteCard.innerHTML = `
                <div class="note-content">${note.content}</div>
                <div class="note-date">Saved on ${formattedDate}</div>
                <div class="note-actions">
                    <button class="btn-secondary small delete-note" data-index="${notesArray.length - 1 - index}">
                        <span class="btn-icon">🗑️</span> Delete
                    </button>
                </div>
            `;
            
            notesContainer.appendChild(noteCard);
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-note').forEach(button => {
            button.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                deleteNote(index);
            });
        });
    });
}

// Delete a note
function deleteNote(index) {
    if (confirm('Are you sure you want to delete this note?')) {
        chrome.storage.local.get(['researchNotes'], function(result) {
            let notesArray = Array.isArray(result.researchNotes) ? result.researchNotes : [];
            
            // Reverse to match display order
            notesArray.reverse();
            notesArray.splice(index, 1);
            notesArray.reverse();
            
            chrome.storage.local.set({ researchNotes: notesArray }, function() {
                showToast('Note deleted', 'success');
                loadSavedNotes();
            });
        });
    }
}

// Display summarized text
function showResult(content) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = 
        `<div class="result-item"><div class="result-content">${content.replace(/\n/g, '<br>')}</div></div>`;
}

// Show toast notification
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'toast';
    
    if (type) {
        toast.classList.add(type);
    }
    
    toast.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}