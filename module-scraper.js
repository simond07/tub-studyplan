let scrapedModules = [];
let scrapedAreas = [];

document.addEventListener('DOMContentLoaded', function() {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const saveModulesBtn = document.getElementById('saveModulesBtn');
    const clearBtn = document.getElementById('clearBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const htmlInput = document.getElementById('htmlInput');
    const scrapingStatus = document.getElementById('scrapingStatus');
    const backButton = document.getElementById('backButton');
    const editModuleModal = document.getElementById('editModuleModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editModuleForm = document.getElementById('editModuleForm');
    
    // Load existing modules from localStorage
    loadModulesFromStorage();
    
    // Event listeners
    scrapeBtn.addEventListener('click', function() {
        let html = htmlInput.value.trim();
        
        if (!html) {
            showStatus('error', 'Bitte HTML einfügen.');
            return;
        }
        
        processHtml(html);
    });
    
    saveModulesBtn.addEventListener('click', function() {
        saveModulesToStorage();
    });
    
    clearBtn.addEventListener('click', function() {
        scrapedModules = [];
        updateModuleTable();
        saveModulesBtn.disabled = true;
        showStatus('info', 'Tabelle wurde geleert.');
    });
    
    deleteAllBtn.addEventListener('click', function() {
        if (confirm('Sind Sie sicher, dass Sie alle Module aus der Datenbank löschen möchten?')) {
            window.moduleDatabase.saveModuleDatabase([]);
            loadModulesFromStorage();
            showStatus('info', 'Alle Module wurden aus der Datenbank gelöscht.');
        }
    });
    
    backButton.addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
    // Modal events
    closeModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);
    
    editModuleForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const moduleId = document.getElementById('editModuleId').value;
        const updatedData = {
            title: document.getElementById('editModuleTitle').value.trim(),
            creditPoints: parseInt(document.getElementById('editModuleLP').value),
            examType: document.getElementById('editModuleExamType').value,
            language: document.getElementById('editModuleLanguage').value,
            semester_offered: document.getElementById('editModuleTurnus').value,
            link: document.getElementById('editModuleLink').value.trim(),
            areaName: document.getElementById('editModuleArea')?.value.trim() || ''
        };
        
        if (updatedData.title && updatedData.creditPoints > 0) {
            // Update the local module
            const moduleIndex = scrapedModules.findIndex(m => m.id === moduleId);
            if (moduleIndex !== -1) {
                scrapedModules[moduleIndex] = {
                    ...scrapedModules[moduleIndex],
                    ...updatedData
                };
            }
            
            updateModuleInDatabase(moduleId, updatedData);
            closeEditModal();
            updateModuleTable();
            showStatus('success', 'Modul erfolgreich aktualisiert.');
        }
    });
    
    // Check if existing modules were loaded
    updateModuleCount();

    // Export button
    const exportDatabaseBtn = document.getElementById('exportDatabaseBtn');
    if (exportDatabaseBtn) {
        exportDatabaseBtn.addEventListener('click', function() {
            window.importExport.exportModuleDatabase();
        });
    }
    
    // Import button
    const importDatabaseBtn = document.getElementById('importDatabaseBtn');
    if (importDatabaseBtn) {
        importDatabaseBtn.addEventListener('click', async function() {
            const modules = await window.importExport.importModuleDatabase();
            if (modules) {
                loadModulesFromStorage();
                showStatus('success', 'Moduldatenbank erfolgreich importiert!');
            }
        });
    }
});

function processHtml(html) {
    showStatus('info', 'Analysiere HTML...');
    
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // First try to extract area information
        extractAreasFromHTML(doc);
        
        // Then try to find module tables
        const moduleTable = findModuleTable(doc);
        
        if (moduleTable) {
            extractModulesFromTable(moduleTable);
        } else {
            // If no specific table found, try generic extraction
            showStatus('warning', 'Keine Modultabelle gefunden. Versuche generische Extraktion...');
            extractModulesGeneric(doc);
        }
    } catch (error) {
        showStatus('error', `Fehler beim Verarbeiten des HTML: ${error.message}`);
        console.error('Error processing HTML:', error);
    }
}

// Clean area name function - added to module-scraper.js
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

function extractAreasFromHTML(doc) {
    // Try to find area information, common patterns in TU Berlin pages
    const areaElements = doc.querySelectorAll('h3, h4, .card h2, .ui-treetable-selectable-node');
    
    areaElements.forEach(element => {
        const areaText = element.textContent.trim();
        
        // Look for common patterns like "Kernbereich", "Pflichtmodule", etc.
        if (areaText && (
            areaText.includes('bereich') || 
            areaText.includes('Pflicht') || 
            areaText.includes('Wahl') ||
            /\d+\.\s+[A-Z]/.test(areaText) // Pattern like "1. Kernbereich"
        )) {
            // Extract LP if available
            let lpMatch = areaText.match(/(\d+)\s*LP/);
            const creditPoints = lpMatch ? parseInt(lpMatch[1]) : 6; // Default to 6 if not found
            
            const areaName = areaText.replace(/\(\d+\s*LP\)/, '').trim();
            const cleanName = cleanAreaName(areaName);
            
            // Generate a consistent ID for this area
            const areaId = 'area_' + cleanName.replace(/\s+/g, '_');
            
            // Create a new area if it doesn't exist already by comparing clean names
            if (cleanName && !scrapedAreas.some(a => cleanAreaName(a.name) === cleanName)) {
                scrapedAreas.push({
                    id: areaId,
                    name: areaName,
                    cleanName: cleanName,
                    creditPoints: creditPoints
                });
            }
        }
    });
    
    // Look for parent-child relationships in tree structures
    const treeNodes = doc.querySelectorAll('.ui-treetable-selectable-node');
    
    if (treeNodes.length > 0) {
        treeNodes.forEach(node => {
            const level = parseInt(node.className.match(/ui-node-level-(\d+)/)?.[1] || '0');
            const nodeName = node.textContent.trim();
            
            // Process only if it's a meaningful name
            if (nodeName && nodeName.length > 3 && !nodeName.includes('Liste') && !nodeName.includes('Semester')) {
                const cleanName = cleanAreaName(nodeName);
                const areaId = 'area_' + cleanName.replace(/\s+/g, '_');
                
                // Only add if not already present
                if (!scrapedAreas.some(a => cleanAreaName(a.name) === cleanName)) {
                    scrapedAreas.push({
                        id: areaId,
                        name: nodeName,
                        cleanName: cleanName,
                        level: level,
                        creditPoints: 6 // Default value
                    });
                }
            }
        });
    }
    
    // Also try to find area information from the page title or headers
    const pageTitle = doc.querySelector('h3')?.textContent.trim();
    if (pageTitle) {
        const cleanName = cleanAreaName(pageTitle);
        const areaId = 'area_' + cleanName.replace(/\s+/g, '_');
        
        // Add the page title as a potential area if not already present
        if (cleanName && !scrapedAreas.some(a => cleanAreaName(a.name) === cleanName)) {
            scrapedAreas.push({
                id: areaId,
                name: pageTitle,
                cleanName: cleanName,
                creditPoints: 30 // Default reasonable value
            });
        }
    }
    
    // Add a button to apply areas to modules if we found areas
    if (scrapedAreas.length > 0) {
        updateAreasList();
        
        // Make apply areas button visible
        const applyAreasBtn = document.getElementById('applyAreasBtn');
        if (applyAreasBtn) {
            applyAreasBtn.classList.remove('hidden');
            
            // Add event listener if not already added
            if (!applyAreasBtn.hasAttribute('data-listener-added')) {
                applyAreasBtn.addEventListener('click', applyAreasToModules);
                applyAreasBtn.setAttribute('data-listener-added', 'true');
            }
        }
    }
}

function updateAreasList() {
    // Add a section to display and select areas
    const moduleList = document.getElementById('moduleList');
    
    // Check if the areas section already exists
    let areasSection = document.getElementById('areasSection');
    if (!areasSection) {
        areasSection = document.createElement('div');
        areasSection.id = 'areasSection';
        areasSection.className = 'mb-6 bg-white p-4 rounded shadow';
        
        const areasSectionHTML = `
            <h2 class="text-xl font-semibold mb-3">Gefundene Bereiche</h2>
            <div class="flex flex-wrap gap-2 mb-3" id="areasList"></div>
        `;
        
        areasSection.innerHTML = areasSectionHTML;
        moduleList.parentNode.insertBefore(areasSection, moduleList);
    }
    
    // Update the areas list
    const areasList = document.getElementById('areasList');
    areasList.innerHTML = '';
    
    scrapedAreas.forEach(area => {
        const areaTag = document.createElement('div');
        areaTag.className = 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-1';
        areaTag.innerHTML = `
            <span>${area.name}</span>
            <span class="bg-blue-200 px-1 rounded-full text-xs">${area.creditPoints} LP</span>
        `;
        areasList.appendChild(areaTag);
    });
}

function findModuleTable(doc) {
    // Look for data tables in the HTML, particularly ones with module data
    const dataTables = doc.querySelectorAll('.ui-datatable table');
    
    // Try to find one that matches our expected format 
    // (contains columns for name, LP, prüfungsform, turnus)
    for (const table of dataTables) {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => 
            th.textContent.trim().toLowerCase());
        
        // Check if this looks like our module table
        if (headers.includes('name:') || 
            headers.some(h => h.includes('name')) && 
            headers.some(h => h.includes('lp')) && 
            headers.some(h => h.includes('prüfungsform'))) {
            return table;
        }
    }
    
    // If we didn't find a matching table, try a more generic approach
    const tables = doc.querySelectorAll('table');
    
    for (const table of tables) {
        const rows = table.querySelectorAll('tbody tr');
        if (rows.length > 0) {
            // Check if any row has a link to a module
            const hasModuleLinks = Array.from(rows).some(row => 
                row.innerHTML.includes('bolognamodule/beschreibung/anzeigen'));
            
            if (hasModuleLinks) {
                return table;
            }
        }
    }
    
    return null;
}
function extractModulesFromTable(table) {
    const moduleRows = table.querySelectorAll('tbody tr');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => 
        th.textContent.trim().toLowerCase());
    
    let foundModules = [];
    
    moduleRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return; // Need at least name, LP, prüfungsform, turnus
        
        // Find the title and link in the first cell
        const titleCell = cells[0];
        const titleLink = titleCell.querySelector('a');
        
        if (!titleLink) return;
        
        const title = titleLink.textContent.trim();
        const link = titleLink.getAttribute('href');
        
        // Find LP, prüfungsform and turnus from specific cells
        let lpIndex = headers.findIndex(h => h.includes('lp'));
        let examIndex = headers.findIndex(h => h.includes('prüfungsform'));
        let turnusIndex = headers.findIndex(h => h.includes('turnus'));
        
        // Default to standard positions if headers don't match
        if (lpIndex === -1) lpIndex = 3;
        if (examIndex === -1) examIndex = 5;
        if (turnusIndex === -1) turnusIndex = 6;
        
        const lp = parseInt(cells[lpIndex]?.textContent.trim()) || 6;
        const examType = cells[examIndex]?.textContent.trim() || 'schriftlich';
        const turnus = cells[turnusIndex]?.textContent.trim() || 'Beides';
        
        // Add extracted area if possible
        let areaName = '';
        // Check if we're in a section with a heading that might indicate the area
        let sectionHeading = table.closest('.section, .card')?.querySelector('h2, h3, h4')?.textContent.trim();
        if (sectionHeading) {
            areaName = sectionHeading;
        }
        
        // Create module object
        const module = {
            id: 'module_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            title: title,
            creditPoints: lp,
            examType: mapExamType(examType),
            language: 'de', // Default
            responsible: '',
            semester_offered: mapSemesterOffered(turnus),
            description: '',
            link: link,
            type: ['VL'],
            areaName: areaName
        };
        
        foundModules.push(module);
    });
    
    if (foundModules.length > 0) {
        mergeScrapedModules(foundModules);
        showStatus('success', `${foundModules.length} Module erfolgreich extrahiert!`);
        document.getElementById('saveModulesBtn').disabled = false;
        updateModuleTable();
    } else {
        showStatus('warning', 'Keine Module in der Tabelle gefunden.');
    }
}

function extractModulesGeneric(doc) {
    // Look for module links which typically point to module descriptions
    const moduleLinks = doc.querySelectorAll('a[href*="bolognamodule/beschreibung"]');
    let foundModules = [];
    
    moduleLinks.forEach(link => {
        const title = link.textContent.trim();
        const href = link.getAttribute('href');
        
        if (!title) return;
        
        // Try to find the parent row or container that might have LP, prüfungsform, etc.
        const container = findParentContainer(link);
        let lp = 6;
        let examType = 'schriftlich';
        let turnus = 'Beides';
        
        if (container) {
            // Try to extract information from the container
            const text = container.textContent;
            
            // Look for LP
            const lpMatch = text.match(/(\d+)\s*LP/i) || text.match(/(\d+)\s*Leistungspunkt/i);
            if (lpMatch) lp = parseInt(lpMatch[1]);
            
            // Look for Prüfungsform
            if (text.match(/schriftlich/i)) examType = 'schriftlich';
            else if (text.match(/mündlich/i)) examType = 'mündlich';
            else if (text.match(/portfolio/i)) examType = 'Portfolio';
            else if (text.match(/projekt/i)) examType = 'Projekt';
            
            // Look for Turnus
            if (text.match(/sose/i) && text.match(/wise/i)) turnus = 'Beides';
            else if (text.match(/sose/i) || text.match(/sommersemester/i)) turnus = 'SoSe';
            else if (text.match(/wise/i) || text.match(/wintersemester/i)) turnus = 'WiSe';
        }
        
        // Create module object
        const module = {
            id: 'module_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            title: title,
            creditPoints: lp,
            examType: mapExamType(examType),
            language: 'de',
            responsible: '',
            semester_offered: mapSemesterOffered(turnus),
            description: '',
            link: href,
            type: ['VL']
        };
        
        foundModules.push(module);
    });
    
    if (foundModules.length > 0) {
        mergeScrapedModules(foundModules);
        showStatus('success', `${foundModules.length} Module erfolgreich extrahiert!`);
        document.getElementById('saveModulesBtn').disabled = false;
        updateModuleTable();
    } else {
        showStatus('warning', 'Keine Module im HTML gefunden.');
    }
}

function findParentContainer(element) {
    // Try to find parent TR, DIV with class card, or other container
    let current = element;
    while (current && current.tagName !== 'BODY') {
        if (current.tagName === 'TR') return current;
        if (current.tagName === 'DIV' && 
            (current.classList.contains('card') || current.classList.contains('module'))) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

function mergeScrapedModules(newModules) {
    // Add new modules, avoid duplicates based on title
    newModules.forEach(newModule => {
        const existingIndex = scrapedModules.findIndex(m => m.title === newModule.title);
        
        if (existingIndex >= 0) {
            // Update existing module with any new information
            scrapedModules[existingIndex] = {
                ...scrapedModules[existingIndex],
                ...newModule,
                id: scrapedModules[existingIndex].id // Keep original ID
            };
        } else {
            // Add new module
            scrapedModules.push(newModule);
        }
    });
}

function updateModuleTable() {
    const tableBody = document.getElementById('modulesTableBody');
    tableBody.innerHTML = '';
    
    if (scrapedModules.length === 0) {
        tableBody.innerHTML = '<tr><td class="border p-2" colspan="7">Noch keine Daten vorhanden</td></tr>';
        return;
    }
    
    scrapedModules.forEach(module => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="border p-2">${module.id}</td>
            <td class="border p-2">
                ${module.link ? 
                    `<a href="${module.link}" target="_blank" class="text-blue-500 hover:underline">${module.title}</a>` : 
                    module.title}
            </td>
            <td class="border p-2">${module.creditPoints}</td>
            <td class="border p-2">${module.examType}</td>
            <td class="border p-2">${module.language}</td>
            <td class="border p-2">${module.semester_offered || 'Beides'}</td>
            <td class="border p-2">
                <div class="flex gap-2">
                    <button class="edit-module-btn text-blue-500 hover:text-blue-700" data-id="${module.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-module-btn text-red-500 hover:text-red-700" data-id="${module.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Add area information if available
        if (module.areaName) {
            row.classList.add('bg-blue-50');
            const titleCell = row.querySelector('td:nth-child(2)');
            const areaTag = document.createElement('div');
            areaTag.className = 'text-xs mt-1 bg-blue-100 inline-block px-2 py-0.5 rounded-full';
            areaTag.textContent = module.areaName;
            titleCell.appendChild(areaTag);
        }
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-module-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-id');
            openEditModal(moduleId);
        });
    });
    
    document.querySelectorAll('.delete-module-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-id');
            deleteModuleFromDatabase(moduleId);
        });
    });
    
    updateModuleCount();
}

function openEditModal(moduleId) {
    const module = scrapedModules.find(m => m.id === moduleId);
    if (!module) return;
    
    // Fill form with module data
    document.getElementById('editModuleId').value = module.id;
    document.getElementById('editModuleTitle').value = module.title;
    document.getElementById('editModuleLP').value = module.creditPoints;
    document.getElementById('editModuleExamType').value = module.examType || 'schriftlich';
    document.getElementById('editModuleLanguage').value = module.language || 'de';
    document.getElementById('editModuleTurnus').value = module.semester_offered || '';
    document.getElementById('editModuleLink').value = module.link || '';
    
    // Add area field if not present
    let areaField = document.getElementById('editModuleArea');
    if (!areaField) {
        const areaRow = document.createElement('div');
        areaRow.innerHTML = `
            <label for="editModuleArea" class="block text-sm font-medium text-gray-700">Bereich</label>
            <input type="text" id="editModuleArea" class="border p-2 w-full rounded" placeholder="Bereich zuordnen">
        `;
        document.getElementById('editModuleForm').insertBefore(
            areaRow,
            document.getElementById('editModuleForm').querySelector('div:last-child')
        );
        areaField = document.getElementById('editModuleArea');
    }
    
    areaField.value = module.areaName || '';
    
    // Show modal
    document.getElementById('editModuleModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModuleModal').classList.add('hidden');
}

function deleteModuleFromDatabase(moduleId) {
    if (confirm('Sind Sie sicher, dass Sie dieses Modul löschen möchten?')) {
        if (window.moduleDatabase.removeModuleFromDatabase(moduleId)) {
            loadModulesFromStorage();
            showStatus('success', 'Modul erfolgreich gelöscht.');
        } else {
            showStatus('error', 'Fehler beim Löschen des Moduls.');
        }
    }
}

function updateModuleInDatabase(moduleId, updatedData) {
    return window.moduleDatabase.updateModuleInDatabase(moduleId, updatedData);
}

function updateModuleCount() {
    const countElem = document.getElementById('moduleCount');
    if (scrapedModules.length > 0) {
        countElem.textContent = `${scrapedModules.length} Module gefunden`;
    } else {
        countElem.textContent = 'Noch keine Module eingelesen';
    }
}

function mapExamType(text) {
    text = text.toLowerCase();
    if (text.includes('schrift') || text.includes('klausur')) return 'schriftlich';
    if (text.includes('münd')) return 'mündlich';
    if (text.includes('projekt')) return 'Projekt';
    if (text.includes('portfolio')) return 'Portfolio';
    return 'schriftlich'; // default
}

function mapLanguage(text) {
    text = text.toLowerCase();
    if (text.includes('englisch')) return 'en';
    if (text.includes('deutsch') && text.includes('englisch')) return 'de/en';
    return 'de'; // default
}

function mapSemesterOffered(text) {
    text = text.toLowerCase();
    if (text.includes('sose') && text.includes('wise')) return 'Beides';
    if (text.includes('sose') || text.includes('sommer')) return 'SoSe';
    if (text.includes('wise') || text.includes('winter')) return 'WiSe';
    if (text.includes('k.a.')) return '';
    return 'Beides'; // default
}

function showStatus(type, message) {
    const statusElement = document.getElementById('scrapingStatus');
    statusElement.classList.remove('hidden', 'bg-blue-100', 'bg-green-100', 'bg-red-100', 'bg-yellow-100');
    
    switch (type) {
        case 'info':
            statusElement.classList.add('bg-blue-100');
            break;
        case 'success':
            statusElement.classList.add('bg-green-100');
            break;
        case 'error':
            statusElement.classList.add('bg-red-100');
            break;
        case 'warning':
            statusElement.classList.add('bg-yellow-100');
            break;
    }
    
    statusElement.textContent = message;
}

// Store scraped areas and their relationship to modules
function saveModulesToStorage() {
    if (scrapedModules.length === 0) {
        showStatus('warning', 'Keine Module zum Speichern vorhanden.');
        return;
    }
    
    try {
        // Get existing modules
        const existingModules = window.moduleDatabase.loadModuleDatabase();
        let mergedModules = [...existingModules];
        
        // Also save the areas if any were found
        if (scrapedAreas.length > 0) {
            localStorage.setItem('scrapedAreas', JSON.stringify(scrapedAreas));
        }
        
        // Merge scraped modules with existing ones
        scrapedModules.forEach(newModule => {
            const existingIndex = mergedModules.findIndex(m => m.title === newModule.title);
            
            if (existingIndex >= 0) {
                mergedModules[existingIndex] = {
                    ...mergedModules[existingIndex],
                    ...newModule,
                    id: mergedModules[existingIndex].id // Keep original ID
                };
            } else {
                mergedModules.push(newModule);
            }
        });
        
        window.moduleDatabase.saveModuleDatabase(mergedModules);
        showStatus('success', `${scrapedModules.length} Module erfolgreich gespeichert!`);
    } catch (error) {
        showStatus('error', `Fehler beim Speichern: ${error.message}`);
    }
    
    // Store scraped areas with proper IDs and clean names
    if (scrapedAreas.length > 0) {
        // Get existing stored areas
        const storedAreas = JSON.parse(localStorage.getItem('storedAreas') || '[]');
        
        // Process each scraped area
        scrapedAreas.forEach(newArea => {
            const cleanName = cleanAreaName(newArea.name);
            
            // Check if this area already exists in stored areas
            const existingIndex = storedAreas.findIndex(a => 
                cleanAreaName(a.name) === cleanName
            );
            
            if (existingIndex === -1) {
                // Area doesn't exist yet, add it with proper ID
                const areaId = 'area_' + cleanName.replace(/\s+/g, '_');
                storedAreas.push({
                    id: areaId,
                    name: newArea.name.trim(),
                    creditPoints: newArea.creditPoints || 6
                });
            }
        });
        
        // Save updated stored areas
        localStorage.setItem('storedAreas', JSON.stringify(storedAreas));
        
        // Also save scraped areas for the current session
        localStorage.setItem('scrapedAreas', JSON.stringify(scrapedAreas.map(area => ({
            id: area.id || ('area_' + cleanAreaName(area.name).replace(/\s+/g, '_')),
            name: area.name.trim(),
            creditPoints: area.creditPoints
        }))));
    }
}

function loadModulesFromStorage() {
    try {
        scrapedModules = window.moduleDatabase.loadModuleDatabase();
        
        // Also load any saved areas
        const savedAreas = localStorage.getItem('scrapedAreas');
        if (savedAreas) {
            scrapedAreas = JSON.parse(savedAreas);
            updateAreasList();
        }
        
        updateModuleTable();
        document.getElementById('saveModulesBtn').disabled = scrapedModules.length === 0;
        showStatus('info', `${scrapedModules.length} Module aus dem Speicher geladen.`);
    } catch (error) {
        console.error('Error loading modules from storage:', error);
    }
}

// Function to apply detected areas to modules
function applyAreasToModules() {
    if (scrapedAreas.length === 0 || scrapedModules.length === 0) {
        showStatus('warning', 'Keine Bereiche oder Module zum Zuordnen gefunden.');
        return;
    }
    
    // If there's only one area, apply it to all modules without area
    if (scrapedAreas.length === 1) {
        const area = scrapedAreas[0];
        let updatedCount = 0;
        
        scrapedModules.forEach(module => {
            if (!module.areaName) {
                module.areaName = area.name;
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            updateModuleTable();
            showStatus('success', `${updatedCount} Module wurden dem Bereich "${area.name}" zugeordnet.`);
        } else {
            showStatus('info', 'Alle Module haben bereits einen Bereich zugeordnet.');
        }
        return;
    }
    
    // If there are multiple areas, show selection dialog
    openAreaSelectionDialog();
}

function openAreaSelectionDialog() {
    // Create modal if it doesn't exist
    let modalContainer = document.getElementById('areaSelectionModal');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'areaSelectionModal';
        modalContainer.className = 'fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50';
        
        modalContainer.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold">Bereich zuordnen</h3>
                    <button id="closeAreaModalBtn" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mb-4">
                    <p>Wählen Sie einen Bereich für die Module ohne Zuordnung:</p>
                    <select id="areaSelectDropdown" class="border p-2 w-full rounded mt-2">
                        ${scrapedAreas.map(area => `<option value="${area.name}">${area.name}</option>`).join('')}
                    </select>
                </div>
                <div class="flex justify-end gap-2">
                    <button id="cancelAreaSelectionBtn" class="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded">Abbrechen</button>
                    <button id="confirmAreaSelectionBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">Zuordnen</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalContainer);
        
        // Add event listeners
        document.getElementById('closeAreaModalBtn').addEventListener('click', closeAreaSelectionModal);
        document.getElementById('cancelAreaSelectionBtn').addEventListener('click', closeAreaSelectionModal);
        document.getElementById('confirmAreaSelectionBtn').addEventListener('click', confirmAreaSelection);
    }
    
    // Show modal
    modalContainer.style.display = 'flex';
}

function closeAreaSelectionModal() {
    const modal = document.getElementById('areaSelectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function confirmAreaSelection() {
    const areaName = document.getElementById('areaSelectDropdown').value;
    let updatedCount = 0;
    
    scrapedModules.forEach(module => {
        if (!module.areaName) {
            module.areaName = areaName;
            updatedCount++;
        }
    });
    
    closeAreaSelectionModal();
    
    if (updatedCount > 0) {
        updateModuleTable();
        showStatus('success', `${updatedCount} Module wurden dem Bereich "${areaName}" zugeordnet.`);
    } else {
        showStatus('info', 'Alle Module haben bereits einen Bereich zugeordnet.');
    }
}
