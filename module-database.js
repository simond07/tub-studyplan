/**
 * Module Database Utility Functions
 * Provides shared functionality for managing the module database
 * across different pages of the application
 */

const DB_KEY = 'moduleDatabase';
const FILTER_KEY = 'moduleDatabaseFilters';

// Helper zum Parsen von Links
function _parseLink(fullLink) {
    if (!fullLink || typeof fullLink !== 'string') {
        return { baseLink: '', version: null };
    }
    try {
        const url = new URL(fullLink); // Verwende URL API für Robustheit
        const version = url.searchParams.get('version');
        url.searchParams.delete('version'); // Entferne Version aus den Parametern
        const baseLink = url.toString();
        return { baseLink, version };
    } catch (e) {
        // Fallback für ungültige URLs oder Links ohne Host etc.
        const parts = fullLink.split('&version=');
        if (parts.length === 2) {
            return { baseLink: parts[0], version: parts[1] };
        }
        return { baseLink: fullLink, version: null };
    }
}

// Load modules from localStorage
function loadModuleDatabase() {
    try {
        const moduleData = localStorage.getItem(DB_KEY);
        const modules = moduleData ? JSON.parse(moduleData) : [];
        // Sicherstellen, dass alle Module die neuen Felder haben (Migration)
        return modules.map(m => ({
             ...m,
             baseLink: m.baseLink ?? _parseLink(m.link).baseLink, // Migriere alte 'link' falls nötig
             version: m.version ?? _parseLink(m.link).version,   // Migriere alte 'link' falls nötig
             lastUpdated: m.lastUpdated || new Date(0).toISOString(), // Setze alten Timestamp, falls nicht vorhanden
             isFavorite: m.isFavorite ?? false,
             isHidden: m.isHidden ?? false,
             // Entferne ggf. das alte 'link' Feld, wenn baseLink existiert
        }));
    } catch (error) {
        console.error('Error loading module database:', error);
        return [];
    }
}

// Save modules to localStorage
function saveModuleDatabase(modules) {
    try {
         // Stelle sicher, dass alle Module das lastUpdated-Feld haben (sollte durch load schon geschehen sein)
         // Aber hier könnten Module direkt hinzugefügt werden, ohne load durchlaufen zu haben
         const modulesToSave = modules.map(m => ({
             ...m,
             lastUpdated: m.lastUpdated || new Date().toISOString(), // Setze Timestamp wenn fehlt
             isFavorite: m.isFavorite ?? false,
             isHidden: m.isHidden ?? false,
         }));
        localStorage.setItem(DB_KEY, JSON.stringify(modulesToSave));
        return true;
    } catch (error) {
        console.error('Error saving module database:', error);
        alert('Fehler beim Speichern der Moduldatenbank. Speicher voll?');
        return false;
    }
}

function addModuleToDatabase(module) {
    if (!module || !module.title) return false;

    const modules = loadModuleDatabase();

    // Parse Link
    const { baseLink, version } = _parseLink(module.link);

    // Check if module with same title already exists
    const existingIndex = modules.findIndex(m => m.title === module.title);

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
        // Update existing module - behalte Favorit/Hidden Status!
        modules[existingIndex] = {
            ...modules[existingIndex], // Behalte alte Flags (favorite, hidden)
            ...module,                 // Überschreibe mit neuen Daten
            id: modules[existingIndex].id, // Behalte original DB ID
            baseLink: baseLink,
            version: version,
            link: undefined, // Entferne das alte link Feld explizit
            lastUpdated: now
        };
    } else {
        // Add new module
        const newDbModule = {
            ...module,
            id: module.id || ('module_db_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
            baseLink: baseLink,
            version: version,
            link: undefined,
            lastUpdated: now,
            isFavorite: false, // Default für neue Module
            isHidden: false   // Default für neue Module
        };
         // Entferne explizit das link feld, falls es in `module` war
         delete newDbModule.link;
        modules.push(newDbModule);
    }

    return saveModuleDatabase(modules);
}

// Remove a module from the database
function removeModuleFromDatabase(moduleId) {
    if (!moduleId) return false;
    
    const modules = loadModuleDatabase();
    const filteredModules = modules.filter(module => module.id !== moduleId);
    
    if (filteredModules.length < modules.length) {
        return saveModuleDatabase(filteredModules);
    }
    
    return false; // No module was removed
}

// Update an existing module in the database
function updateModuleInDatabase(moduleId, updatedData) {
    if (!moduleId || !updatedData) return false;

    const modules = loadModuleDatabase();
    const moduleIndex = modules.findIndex(module => module.id === moduleId);

    if (moduleIndex >= 0) {
        const originalModule = modules[moduleIndex];

        // Parse Link falls im Update enthalten
        let linkData = {};
        if (updatedData.link) {
             linkData = _parseLink(updatedData.link);
        } else if (updatedData.baseLink !== undefined || updatedData.version !== undefined) {
             // Erlaube separates Update von baseLink und version
             linkData.baseLink = updatedData.baseLink ?? originalModule.baseLink;
             linkData.version = updatedData.version ?? originalModule.version;
        }


        modules[moduleIndex] = {
            ...originalModule,      // Behalte alle alten Felder (inkl. ID, favorite, hidden)
            ...updatedData,         // Überschreibe mit Update-Daten
            baseLink: linkData.baseLink !== undefined ? linkData.baseLink : originalModule.baseLink,
            version: linkData.version !== undefined ? linkData.version : originalModule.version,
            link: undefined,        // Entferne altes Feld
            lastUpdated: new Date().toISOString() // Immer aktualisieren
        };
         // Entferne explizit das Link Feld aus updatedData, falls vorhanden
         delete modules[moduleIndex].link;

        return saveModuleDatabase(modules);
    }

    return false; // Module not found
}

// NEU: Filter speichern/laden
function loadDbFilters() {
    try {
        const filterData = localStorage.getItem(FILTER_KEY);
        return filterData ? JSON.parse(filterData) : []; // Gibt ein Array von Filterobjekten zurück
    } catch (error) {
        console.error('Error loading DB filters:', error);
        return [];
    }
}

function saveDbFilters(filters) {
     if (!Array.isArray(filters)) {
         console.error('Invalid data type for filters, expected array.');
         return false;
     }
    try {
        localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
        return true;
    } catch (error) {
        console.error('Error saving DB filters:', error);
        return false;
    }
}

// Clean area name function - added to module-database.js
function cleanAreaName(name) {
    if (!name) return '';
    return name.replace(/\s*\(\d+\s*LP\)$/, '') // Remove LP count
              .replace(/\s+\d+$/, '') // Remove trailing numbers with whitespace before them
              .replace(/_\d+$/, '') // Remove trailing IDs
              .replace(/area_\d+_/, '') // Remove area prefix IDs
              .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
              .trim()
              .toLowerCase();
}

// Load stored areas
function loadStoredAreas() {
    try {
        const areas = localStorage.getItem('storedAreas');
        return areas ? JSON.parse(areas) : [];
    } catch (error) {
        console.error('Error loading stored areas:', error);
        return [];
    }
}

// Save a new area - updated for better ID handling
function saveAreaToDatabase(area) {
    if (!area || !area.name) return false;
    
    const areas = loadStoredAreas();
    
    // Generate clean ID for the area
    const cleanName = cleanAreaName(area.name);
    const areaId = area.id || ('area_' + cleanName.replace(/\s+/g, '_'));
    
    // Check if area with same clean name already exists
    const existingIndex = areas.findIndex(a => 
        cleanAreaName(a.name) === cleanName
    );
    
    if (existingIndex >= 0) {
        // Update existing area
        areas[existingIndex] = {
            ...areas[existingIndex],
            creditPoints: area.creditPoints,
            id: areaId
        };
    } else {
        // Add new area with ID
        areas.push({
            ...area,
            id: areaId,
            name: area.name.trim() // Store trimmed original name
        });
    }
    
    try {
        localStorage.setItem('storedAreas', JSON.stringify(areas));
        return true;
    } catch (error) {
        console.error('Error saving area to database:', error);
        return false;
    }
}

// Exports for use in both app.js and module-scraper.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadModuleDatabase,
        saveModuleDatabase,
        addModuleToDatabase,
        removeModuleFromDatabase,
        updateModuleInDatabase,
        loadStoredAreas,
        saveAreaToDatabase
    };
} else {
    // Make functions available globally if not in a module environment
    window.moduleDatabase = {
        loadModuleDatabase,
        saveModuleDatabase,
        addModuleToDatabase,
        removeModuleFromDatabase,
        updateModuleInDatabase,
        loadStoredAreas,
        saveAreaToDatabase,
        loadDbFilters, // Exportieren
        saveDbFilters  // Exportieren
    };
}
