/**
 * Import/Export Utility Functions
 * Provides functionality for importing and exporting study plan data and module databases
 */

// Export study plan to file
async function exportStudyPlan(areas, courses) {
    const data = {
        areas: areas,
        modules: courses,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };

    const jsonString = JSON.stringify(data, null, 2);
    await saveToFile(jsonString, 'studyplan.json');
    return true;
}

// Export module database to file
async function exportModuleDatabase() {
    const moduleDatabase = window.moduleDatabase.loadModuleDatabase();
    const scrapedAreas = JSON.parse(localStorage.getItem('scrapedAreas') || '[]');
    
    const data = {
        modules: moduleDatabase,
        areas: scrapedAreas,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };

    const jsonString = JSON.stringify(data, null, 2);
    await saveToFile(jsonString, 'module_database.json');
    return true;
}

// Generic save to file function
async function saveToFile(jsonString, defaultFilename) {
    // Check if the File System Access API is supported
    if ('showSaveFilePicker' in window) {
        const options = {
            suggestedName: defaultFilename,
            types: [{
                description: 'JSON Files',
                accept: {
                    'application/json': ['.json']
                }
            }]
        };

        try {
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            console.log('Data saved to file successfully.');
            return true;
        } catch (error) {
            console.error('Error saving to file:', error);
            fallbackSave(jsonString, defaultFilename);
            return true;
        }
    } else {
        // Fallback for browsers that don't support the File System Access API
        fallbackSave(jsonString, defaultFilename);
        return true;
    }
}

// Fallback save method using Blob and download attribute
function fallbackSave(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
}

// Import study plan from file
async function importStudyPlan() {
    try {
        const fileContent = await readFile();
        if (!fileContent) return null;
        
        const data = JSON.parse(fileContent);
        
        // Validate the data format
        if (!data.areas || !Array.isArray(data.areas) || !data.modules || !Array.isArray(data.modules)) {
            throw new Error("Ungültiges Dateiformat: Bereiche oder Module fehlen.");
        }
        
        return data;
    } catch (error) {
        console.error('Error importing study plan:', error);
        alert(`Fehler beim Importieren: ${error.message}`);
        return null;
    }
}

// Import module database from file
async function importModuleDatabase() {
    try {
        const fileContent = await readFile();
        if (!fileContent) return null;
        
        const data = JSON.parse(fileContent);
        
        // Validate the data format
        if (!data.modules || !Array.isArray(data.modules)) {
            throw new Error("Ungültiges Dateiformat: Modul-Liste fehlt.");
        }
        
        // Save modules to localStorage
        window.moduleDatabase.saveModuleDatabase(data.modules);
        
        // Save areas if available
        if (data.areas && Array.isArray(data.areas)) {
            localStorage.setItem('scrapedAreas', JSON.stringify(data.areas));
        }
        
        return data.modules;
    } catch (error) {
        console.error('Error importing module database:', error);
        alert(`Fehler beim Importieren: ${error.message}`);
        return null;
    }
}

// Generic read file function
async function readFile() {
    // Check if the File System Access API is supported
    if ('showOpenFilePicker' in window) {
        try {
            const options = {
                types: [{
                    description: 'JSON Files',
                    accept: {
                        'application/json': ['.json']
                    }
                }],
                multiple: false
            };
            
            const [fileHandle] = await window.showOpenFilePicker(options);
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening file:', error);
                alert(`Fehler beim Öffnen der Datei: ${error.message}`);
            }
            return null;
        }
    } else {
        // Fallback for browsers that don't support the File System Access API
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => {
                    alert('Fehler beim Lesen der Datei');
                    resolve(null);
                };
                reader.readAsText(file);
            };
            
            // Trigger file selection dialog
            input.click();
        });
    }
}

// Make functions available globally
window.importExport = {
    exportStudyPlan,
    exportModuleDatabase,
    importStudyPlan,
    importModuleDatabase
};
