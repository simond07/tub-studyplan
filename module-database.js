/**
 * Module Database Utility Functions
 * Provides shared functionality for managing the module database
 * across different pages of the application
 */

// Load modules from localStorage
function loadModuleDatabase() {
    try {
        const moduleData = localStorage.getItem('moduleDatabase');
        return moduleData ? JSON.parse(moduleData) : [];
    } catch (error) {
        console.error('Error loading module database:', error);
        return [];
    }
}

// Save modules to localStorage
function saveModuleDatabase(modules) {
    try {
        localStorage.setItem('moduleDatabase', JSON.stringify(modules));
        return true;
    } catch (error) {
        console.error('Error saving module database:', error);
        return false;
    }
}

// Add a new module to the database
function addModuleToDatabase(module) {
    if (!module || !module.title) return false;

    const modules = loadModuleDatabase();
    
    // Generate a unique ID if not provided
    if (!module.id) {
        module.id = 'module_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }
    
    // Check if module with same title already exists
    const existingIndex = modules.findIndex(m => m.title === module.title);
    
    if (existingIndex >= 0) {
        // Update existing module
        modules[existingIndex] = {
            ...modules[existingIndex],
            ...module,
            id: modules[existingIndex].id // Keep original ID
        };
    } else {
        // Add new module
        modules.push(module);
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
        modules[moduleIndex] = {
            ...modules[moduleIndex],
            ...updatedData,
            id: moduleId // Ensure ID doesn't change
        };
        return saveModuleDatabase(modules);
    }
    
    return false; // Module not found
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

// Save a new area
function saveAreaToDatabase(area) {
    if (!area || !area.name) return false;
    
    const areas = loadStoredAreas();
    
    // Clean area name for comparison
    function cleanAreaName(name) {
        return name.toLowerCase().replace(/\s+/g, ' ').trim();
    }
    
    // Check if area with same name already exists
    const existingIndex = areas.findIndex(a => 
        cleanAreaName(a.name) === cleanAreaName(area.name)
    );
    
    if (existingIndex >= 0) {
        // Update existing area
        areas[existingIndex] = {
            ...areas[existingIndex],
            ...area
        };
    } else {
        // Add new area
        areas.push(area);
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
        saveAreaToDatabase
    };
}
