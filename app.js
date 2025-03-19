let areas = [];
let courses = [];

// Clean area name function - removes any IDs or special characters
function cleanAreaName(name) {
    if (!name) return '';
    return name.replace(/\s*\(\d+\s*LP\)$/, '') // Remove LP count
              .replace(/_\d+$/, '') // Remove trailing IDs
              .replace(/area_\d+_/, '') // Remove area prefix IDs
              .trim()
              .toLowerCase();
}

// Save area to database for reuse
function saveAreaToDatabase(areaName, creditPoints) {
    try {
        const storedAreas = JSON.parse(localStorage.getItem('storedAreas') || '[]');
        
        // Check if area already exists
        const existingAreaIndex = storedAreas.findIndex(area => 
            cleanAreaName(area.name) === cleanAreaName(areaName)
        );
        
        if (existingAreaIndex >= 0) {
            // Update existing area
            storedAreas[existingAreaIndex].creditPoints = creditPoints;
        } else {
            // Add new area
            storedAreas.push({
                name: areaName,
                creditPoints: creditPoints
            });
        }
        
        localStorage.setItem('storedAreas', JSON.stringify(storedAreas));
        return true;
    } catch (error) {
        console.error('Error saving area to database:', error);
        return false;
    }
}

// Store responsible persons and departments
let responsiblePersons = [];
let departments = [];

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addAreaForm').addEventListener('submit', function(event) {
        event.preventDefault();
        addArea();
    });

    document.getElementById('addModuleForm').addEventListener('submit', function(event) {
        event.preventDefault();
        addModule();
    });

    // Set default values for forms
    document.getElementById('areaCreditPointsInput').value = '6';
    document.getElementById('moduleExamTypeInput').value = 'schriftlich';
    document.getElementById('moduleLanguageSelect').value = 'de';
    document.getElementById('moduleSemesterOfferedSelect').value = 'Beides';
    document.getElementById('moduleSemesterInput').value = '1';
    document.getElementById('moduleCreditPointsInput').value = '6';
    
    // Initialize data
    loadFromLocalStorage();
    setupAreaAutocomplete();
    setupModuleAutocomplete();
    setupResponsibleAutocomplete();
    setupDepartmentAutocomplete();
    updateModuleDatabaseCount();
    updateModuleDatabaseTable();
    renderAreas(); // Initiales Rendern
    
    // Initialize import/export buttons
    const importButton = document.getElementById('importButton');
    if (importButton) {
        importButton.addEventListener('click', importStudyPlan);
    }

    // Initialize modal event listeners
    const areaEditModal = document.getElementById('areaEditModal');
    const moduleEditModal = document.getElementById('moduleEditModal');
    
    if (areaEditModal) {
        areaEditModal.addEventListener('click', function(e) {
            if (e.target === this) closeAreaEditModal();
        });
        
        document.getElementById('closeAreaModalBtn').onclick = closeAreaEditModal;
        document.getElementById('cancelAreaEditBtn').onclick = closeAreaEditModal;
        
        document.getElementById('editAreaForm').onsubmit = function(e) {
            e.preventDefault();
            saveAreaEditChanges();
        };
    }
    
    if (moduleEditModal) {
        moduleEditModal.addEventListener('click', function(e) {
            if (e.target === this) closeModuleEditModal();
        });
        
        document.getElementById('closeModuleModalBtn').onclick = closeModuleEditModal;
        document.getElementById('cancelModuleEditBtn').onclick = closeModuleEditModal;
        
        document.getElementById('editModuleForm').onsubmit = function(e) {
            e.preventDefault();
            saveModuleEditChanges();
        };
    }
    
    lucide.createIcons();
});

// Function to choose a color from the Tailwind colors for each semester
function generateColor(semester) {
    const tailwindColors = [
        'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
        'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    return tailwindColors[semester % tailwindColors.length];
}

// Bereiche rendern
function renderAreas() {
    const areasContainer = document.getElementById('areasContainer');
    const moduleAreaSelect = document.getElementById('moduleAreaSelect');
    const parentAreaSelect = document.getElementById('parentAreaSelect');
    const semesterContainer = document.getElementById('semesterContainer');
    
    areasContainer.innerHTML = ''; // Aktuellen Inhalt löschen
    moduleAreaSelect.innerHTML = '<option value="">Bereich auswählen</option>'; // Reset des Select
    parentAreaSelect.innerHTML = '<option value="">Kein Übergeordneter Bereich</option>'; // Reset des Parent Select

    // Funktion zum rekursiven Rendern der Bereiche
    function renderAreaHierarchy(parentId = null, level = 0) {
        const filteredAreas = areas.filter(area => area.parentId === parentId);
        
        filteredAreas.forEach((area, index) => {
            // Bereich zum Select hinzufügen
            const option = document.createElement('option');
            option.value = area.id;
            option.textContent = '  '.repeat(level) + area.name + ` (${area.creditPoints} LP)`;
            moduleAreaSelect.appendChild(option);
            
            // Bereich zum Parent-Select hinzufügen
            const parentOption = document.createElement('option');
            parentOption.value = area.id;
            parentOption.textContent = '  '.repeat(level) + area.name + ` (${area.creditPoints} LP)`;
            parentAreaSelect.appendChild(parentOption);

            const areaDiv = document.createElement('div');
            areaDiv.className = 'bg-white rounded-md shadow px-2 py-4 mb-4 flex flex-col justify-between gap-2';
            areaDiv.style.marginLeft = `${level * 20}px`;
            
            const areaHeader = document.createElement('div');
            areaHeader.className = 'flex justify-between items-center w-full px-2';

            const areaTitle = document.createElement('h2');
            areaTitle.innerText = `${area.name} (${area.creditPoints} LP)`;
            areaTitle.className = 'text-lg font-bold';
            areaHeader.appendChild(areaTitle);

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'flex gap-2 ml-8 items-center';

            // Bearbeiten Button mit Lucide Icon
            const editButton = document.createElement('button');
            editButton.innerHTML = '<i data-lucide="edit" class="size-4"></i>';
            editButton.classList.add('area-edit-btn');
            editButton.setAttribute('data-id', area.id);
            buttonContainer.appendChild(editButton);

            // Löschen Button mit Lucide Icon
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
            deleteButton.classList.add('area-delete-btn');
            deleteButton.setAttribute('data-id', area.id);
            buttonContainer.appendChild(deleteButton);

            areaHeader.appendChild(buttonContainer);
            areaDiv.appendChild(areaHeader);

            // LP-Verbrauch anzeigen
            const childrenLP = getChildrenTotalLP(area.id);
            const lpUsageDiv = document.createElement('div');
            lpUsageDiv.className = 'text-sm px-2';
            lpUsageDiv.innerHTML = `<span>Verwendet: ${childrenLP} von ${area.creditPoints} LP</span>`;
            if (childrenLP > area.creditPoints) {
                lpUsageDiv.classList.add('text-red-500', 'font-bold');
            }
            areaDiv.appendChild(lpUsageDiv);

            const moduleList = document.createElement('div');
            
            const areaModules = courses.filter(module => module.areaId === area.id);
            areaModules.forEach((module) => {
                const moduleDiv = document.createElement('div');
                moduleDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded mb-1';
                
                const moduleInfo = document.createElement('div');
                moduleInfo.className = 'flex flex-col';
                
                const moduleTitle = document.createElement('span');
                moduleTitle.className = 'font-medium';
                moduleTitle.innerText = `${module.title} (${module.creditPoints} LP, Semester: ${module.semester})`;
                moduleInfo.appendChild(moduleTitle);
                
                const moduleDetails = document.createElement('span');
                moduleDetails.className = 'text-sm text-gray-600';
                moduleDetails.innerText = `${module.type.join(', ')} | ${module.examType} | ${module.language} | Turnus: ${module.semester_offered}`;
                moduleInfo.appendChild(moduleDetails);
                
                moduleDiv.appendChild(moduleInfo);
                
                // Bearbeiten und Entfernen Buttons für Module mit Lucide Icons
                const moduleButtonContainer = document.createElement('div');
                moduleButtonContainer.className = 'flex gap-2 ml-8 items-center';

                // Bearbeiten Button mit Lucide Icon
                const moduleEditButton = document.createElement('button');
                moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-4"></i>';
                moduleEditButton.classList.add('module-edit-btn');
                moduleEditButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleEditButton);

                // Löschen Button mit Lucide Icon
                const moduleDeleteButton = document.createElement('button');
                moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
                moduleDeleteButton.classList.add('module-delete-btn');
                moduleDeleteButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleDeleteButton);

                moduleDiv.appendChild(moduleButtonContainer);
                moduleList.appendChild(moduleDiv);
            });

            areaDiv.appendChild(moduleList);
            areasContainer.appendChild(areaDiv);
            
            // Rekursiv Unterbereiche rendern
            renderAreaHierarchy(area.id, level + 1);
        });
    }
    
    // Starte mit Top-Level Bereichen (ohne Parent)
    renderAreaHierarchy(null);

    // Semestercontainer aktualisieren
    updateSemesterView();
    
    // Lucide Icons aktualisieren
    lucide.createIcons();

    // Add event delegation for course modules in area container
    if (areasContainer && !areasContainer.hasAttribute('data-listeners-added')) {
        areasContainer.setAttribute('data-listeners-added', 'true');
        areasContainer.addEventListener('click', function(event) {
            const button = event.target.closest('button');
            if (!button) return;
            
            if (button.classList.contains('module-edit-btn')) {
                const moduleId = button.getAttribute('data-id');
                const module = courses.find(m => m.id === moduleId);
                if (module) {
                    openModuleEditModal(module, false);
                }
            }
            else if (button.classList.contains('module-delete-btn')) {
                const moduleId = button.getAttribute('data-id');
                if (confirm('Sind Sie sicher, dass Sie dieses Modul entfernen möchten?')) {
                    removeModule(moduleId);
                }
            }
            else if (button.classList.contains('area-edit-btn')) {
                const areaId = button.getAttribute('data-id');
                editArea(areaId);
            }
            else if (button.classList.contains('area-delete-btn')) {
                const areaId = button.getAttribute('data-id');
                if (confirm('Sind Sie sicher, dass Sie diesen Bereich entfernen möchten?')) {
                    removeArea(areaId);
                }
            }
        });
    }

    // Also add event delegation for semester container
    if (semesterContainer && !semesterContainer.hasAttribute('data-listeners-added')) {
        semesterContainer.setAttribute('data-listeners-added', 'true');
        semesterContainer.addEventListener('click', function(event) {
            const button = event.target.closest('button');
            if (!button) return;
            
            if (button.classList.contains('module-edit-btn')) {
                const moduleId = button.getAttribute('data-id');
                const module = courses.find(m => m.id === moduleId);
                if (module) {
                    openModuleEditModal(module, false);
                }
            }
            else if (button.classList.contains('module-delete-btn')) {
                const moduleId = button.getAttribute('data-id');
                if (confirm('Sind Sie sicher, dass Sie dieses Modul entfernen möchten?')) {
                    removeModule(moduleId);
                }
            }
        });
    }
}

// Berechnet die Summe der LP aller Unterbereiche eines Bereichs
function getChildrenTotalLP(parentId) {
    // Direkte Unterbereiche
    const childAreas = areas.filter(area => area.parentId === parentId);
    let totalLP = childAreas.reduce((sum, area) => sum + area.creditPoints, 0);
    
    // Module, die direkt diesem Bereich zugeordnet sind
    const directModules = courses.filter(module => module.areaId === parentId);
    totalLP += directModules.reduce((sum, module) => sum + module.creditPoints, 0);
    
    return totalLP;
}

// Semester-Übersicht aktualisieren
function updateSemesterView() {
    const semesterContainer = document.getElementById('semesterContainer');
    semesterContainer.innerHTML = '';

    // Module nach Semestern sortieren
    const sortedModules = courses.slice().sort((a, b) => a.semester - b.semester);

    // Module nach Semestern gruppieren
    const modulesBySemester = sortedModules.reduce((acc, module) => {
        if (!acc[module.semester]) {
            acc[module.semester] = [];
        }
        acc[module.semester].push(module);
        return acc;
    }, {});

    // Module nach Semestern rendern
    for (const [semester, modules] of Object.entries(modulesBySemester)) {
        const semesterDiv = document.createElement('div');
        semesterDiv.className = `p-2 rounded-md shadow mb-4 ${generateColor(semester)}/30`;

        // Calculate total LPs for this semester
        const totalLP = modules.reduce((sum, module) => sum + module.creditPoints, 0);
        
        const semesterHeader = document.createElement('div');
        semesterHeader.className = 'flex justify-between items-center mb-2';
        
        const semesterTitle = document.createElement('h3');
        semesterTitle.innerText = `Semester ${semester}`;
        semesterTitle.className = 'text-xl font-bold';
        semesterHeader.appendChild(semesterTitle);
        
        const lpCounter = document.createElement('span');
        lpCounter.className = 'bg-gray-200 py-1 px-3 rounded-full text-sm font-bold';
        lpCounter.innerText = `${totalLP} LP`;
        
        // Highlight if LP count is unusual
        if (totalLP < 24) {
            lpCounter.classList.add('bg-yellow-200');
        } else if (totalLP > 33) {
            lpCounter.classList.add('bg-red-200');
        } else {
            lpCounter.classList.add('bg-green-200');
        }
        
        semesterHeader.appendChild(lpCounter);
        semesterDiv.appendChild(semesterHeader);

        modules.forEach((module) => {
            const moduleDiv = document.createElement('div');
            moduleDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded mb-1';

            // Finde den Bereichsnamen für dieses Modul
            const moduleArea = areas.find(area => area.id === module.areaId);
            const areaName = moduleArea ? moduleArea.name : "Kein Bereich";

            const moduleInfo = document.createElement('div');
            moduleInfo.className = 'flex flex-col';
            
            const moduleTitle = document.createElement('span');
            moduleTitle.className = 'font-medium';
            moduleTitle.innerText = `${module.title} (${module.creditPoints} LP)`;
            moduleInfo.appendChild(moduleTitle);
            
            const moduleDetails = document.createElement('span');
            moduleDetails.className = 'text-sm text-gray-600';
            moduleDetails.innerText = `Bereich: ${areaName} | ${module.type.join(', ')} | ${module.examType}`;
            moduleInfo.appendChild(moduleDetails);
            
            moduleDiv.appendChild(moduleInfo);

            // Bearbeiten und Entfernen Buttons für Module
            const moduleButtonContainer = document.createElement('div');
            moduleButtonContainer.className = 'flex gap-2 ml-8 items-center';

            const moduleEditButton = document.createElement('button');
            moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-4"></i>';
            moduleEditButton.classList.add('module-edit-btn');
            moduleEditButton.setAttribute('data-id', module.id);
            moduleButtonContainer.appendChild(moduleEditButton);

            const moduleDeleteButton = document.createElement('button');
            moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
            moduleDeleteButton.classList.add('module-delete-btn');
            moduleDeleteButton.setAttribute('data-id', module.id);
            moduleButtonContainer.appendChild(moduleDeleteButton);

            moduleDiv.appendChild(moduleButtonContainer);
            semesterDiv.appendChild(moduleDiv);
        });

        semesterContainer.appendChild(semesterDiv);
    }
}

// Bereich hinzufügen - with duplicate checking and area name cleaning
function addArea() {
    const areaInput = document.getElementById('areaInput');
    const lpInput = document.getElementById('areaCreditPointsInput');
    const parentSelect = document.getElementById('parentAreaSelect');
    
    // Hide any previous error messages
    document.getElementById('areaInputError').classList.add('hidden');
    document.getElementById('areaCreditPointsError').classList.add('hidden');
    
    const newAreaName = areaInput.value.trim();
    const creditPoints = parseInt(lpInput.value) || 0;
    const parentId = parentSelect.value || null;
    
    let isValid = true;
    
    // Validate area name
    if (!newAreaName) {
        document.getElementById('areaInputError').classList.remove('hidden');
        isValid = false;
    }
    
    // Main areas (without parent) require credit points, sub-areas don't
    if (creditPoints <= 0 && !parentId) {
        document.getElementById('areaCreditPointsError').classList.remove('hidden');
        isValid = false;
    }
    
    if (isValid) {
        // Check if area with same name already exists
        const existingArea = areas.find(area => 
            cleanAreaName(area.name) === cleanAreaName(newAreaName)
        );
        
        if (existingArea) {
            if (confirm(`Bereich "${existingArea.name}" existiert bereits. Möchten Sie diesen Bereich bearbeiten?`)) {
                editArea(existingArea.id);
                return;
            }
        }
        
        // Generiere unique ID ohne zufällige Nummern
        const cleanName = cleanAreaName(newAreaName).replace(/\s+/g, '_');
        const areaId = 'area_' + cleanName;
        
        areas.push({ 
            id: areaId,
            name: newAreaName,
            creditPoints: creditPoints,
            parentId: parentId
        });
        
        // Also save to database for future use
        saveAreaToDatabase(newAreaName, creditPoints);
        
        areaInput.value = '';
        lpInput.value = '6'; // Reset to default value
        parentSelect.value = '';
        
        saveToLocalStorage();
        renderAreas();
    }
}

// Bereich bearbeiten with improved modal
function editArea(areaId) {
    const areaIndex = areas.findIndex(area => area.id === areaId);
    if (areaIndex === -1) return;
    
    const area = areas[areaIndex];
    
    // Use the modal instead of prompts
    openAreaEditModal(area);
}

function openAreaEditModal(area) {
    // Fill the form fields
    document.getElementById('editAreaId').value = area.id;
    document.getElementById('editAreaName').value = area.name;
    document.getElementById('editAreaLP').value = area.creditPoints;
    
    // Populate parent options
    const parentSelect = document.getElementById('editAreaParent');
    parentSelect.innerHTML = '<option value="">Kein Übergeordneter Bereich</option>';
    
    // Add all areas except the current one and its children
    const possibleParents = areas.filter(a => a.id !== area.id);
    possibleParents.forEach((a, i) => {
        // Check if this would create a circular dependency
        let currentParent = a.id;
        let hasCircular = false;
        
        while (currentParent) {
            if (currentParent === area.id) {
                hasCircular = true;
                break;
            }
            const parentArea = areas.find(pa => pa.id === currentParent);
            currentParent = parentArea ? parentArea.parentId : null;
        }
        
        if (!hasCircular) {
            const option = document.createElement('option');
            option.value = a.id;
            option.textContent = a.name;
            option.selected = a.id === area.parentId;
            parentSelect.appendChild(option);
        }
    });
    
    // Show the modal
    const modal = document.getElementById('areaEditModal');
    modal.classList.remove('hidden');
    
    // Setup event listeners if not already added
    if (!document.getElementById('closeAreaModalBtn').hasAttribute('data-listener')) {
        document.getElementById('closeAreaModalBtn').setAttribute('data-listener', 'true');
        document.getElementById('closeAreaModalBtn').onclick = closeAreaEditModal;
        document.getElementById('cancelAreaEditBtn').onclick = closeAreaEditModal;
        
        document.getElementById('editAreaForm').onsubmit = function(e) {
            e.preventDefault();
            
            const newName = document.getElementById('editAreaName').value.trim();
            const newLP = parseInt(document.getElementById('editAreaLP').value);
            const newParentId = document.getElementById('editAreaParent').value || null;
            
            if (newName && newLP > 0) {
                // Update area
                areas[areaIndex] = {
                    ...area,
                    name: newName,
                    creditPoints: newLP,
                    parentId: newParentId
                };
                
                // Also update in the database
                saveAreaToDatabase(newName, newLP);
                
                saveToLocalStorage();
                renderAreas();
                closeAreaEditModal();
            }
        };
    }
}

function closeAreaEditModal() {
    const modal = document.getElementById('areaEditModal');
    modal.classList.add('hidden');
}

// Bereich entfernen
function removeArea(areaId) {
    // Prüfen, ob dieser Bereich Unterbereiche hat
    const hasChildren = areas.some(area => area.parentId === areaId);
    
    if (hasChildren) {
        if (!confirm("Dieser Bereich hat Unterbereiche. Möchten Sie trotzdem fortfahren? Alle Unterbereiche werden ebenfalls gelöscht.")) {
            return;
        }
        
        // Rekursiv alle Unterbereiche entfernen
        function removeChildAreas(parentId) {
            const childrenIds = areas.filter(area => area.parentId === parentId).map(a => a.id);
            childrenIds.forEach(childId => {
                removeChildAreas(childId);
                areas = areas.filter(area => area.id !== childId);
            });
        }
        
        removeChildAreas(areaId);
    }
    
    // Module aktualisieren, die diesem Bereich zugeordnet waren
    courses.forEach(module => {
        if (module.areaId === areaId) {
            module.areaId = null;
        }
    });
    
    // Bereich entfernen
    areas = areas.filter(area => area.id !== areaId);
    
    saveToLocalStorage();
    renderAreas();
}

// Modul hinzufügen
function addModule() {
    // Hide any previous error messages
    document.getElementById('moduleTitleError').classList.add('hidden');
    document.getElementById('moduleAreaError').classList.add('hidden');
    document.getElementById('moduleSemesterError').classList.add('hidden');
    document.getElementById('moduleCreditPointsError').classList.add('hidden');

    const titleInput = document.getElementById('moduleTitleInput');
    const areaSelect = document.getElementById('moduleAreaSelect');
    const semesterInput = document.getElementById('moduleSemesterInput');
    const creditPointsInput = document.getElementById('moduleCreditPointsInput');
    const descriptionInput = document.getElementById('moduleDescriptionInput');
    const linkInput = document.getElementById('moduleLinkInput');
    const responsibleInput = document.getElementById('moduleResponsibleInput');
    const examTypeInput = document.getElementById('moduleExamTypeInput');
    const languageSelect = document.getElementById('moduleLanguageSelect');
    const departmentInput = document.getElementById('moduleDepartmentInput');
    const semesterOfferedSelect = document.getElementById('moduleSemesterOfferedSelect');
    
    // Checkboxen für Modultyp auslesen
    const typeCheckboxes = document.querySelectorAll('input[name="moduleType"]:checked');
    const selectedTypes = Array.from(typeCheckboxes).map(cb => cb.value);

    const title = titleInput.value.trim();
    let areaId = areaSelect.value;
    const semester = parseInt(semesterInput.value);
    const creditPoints = parseInt(creditPointsInput.value) || 0;
    
    // Optional fields
    const description = descriptionInput.value.trim();
    const link = linkInput.value.trim();
    const responsible = responsibleInput.value.trim();
    const examType = examTypeInput.value;
    const language = languageSelect.value;
    const department = departmentInput.value.trim();
    const semesterOffered = semesterOfferedSelect.value;

    let isValid = true;
    
    // Validate required fields
    if (!title) {
        document.getElementById('moduleTitleError').classList.remove('hidden');
        isValid = false;
    }
    
    if (!areaId) {
        document.getElementById('moduleAreaError').classList.remove('hidden');
        isValid = false;
    }
    
    if (!semester || semester <= 0) {
        document.getElementById('moduleSemesterError').classList.remove('hidden');
        isValid = false;
    }
    
    if (creditPoints <= 0) {
        document.getElementById('moduleCreditPointsError').classList.remove('hidden');
        isValid = false;
    }
    
    if (isValid) {
        // If no module type is selected, default to VL
        const finalTypes = selectedTypes.length > 0 ? selectedTypes : [''];
        
        // Generiere unique ID
        const moduleId = 'module_' + Date.now();
        
        // If the module is from the database, try to get its original information
        let moduleFromDB = null;
        const moduleDB = window.moduleDatabase.loadModuleDatabase();
        if (moduleDB) {
            moduleFromDB = moduleDB.find(m => m.title === title);
        }
        
        // Create areas from scraped information if needed
        if (moduleFromDB && moduleFromDB.areaName && !areaId) {
            // Check if we already have an area with this name
            const existingArea = areas.find(a => a.name === moduleFromDB.areaName);
            
            if (existingArea) {
                // Use existing area
                areaId = existingArea.id;
            } else {
                // Create a new area based on scraped information
                const newAreaId = 'area_' + Date.now();
                areas.push({
                    id: newAreaId,
                    name: moduleFromDB.areaName,
                    creditPoints: 30, // Default reasonable value
                    parentId: null
                });
                areaId = newAreaId;
                
                // Re-render areas to show the new area
                renderAreas();
                
                // Update the area select with the new area
                const areaSelect = document.getElementById('moduleAreaSelect');
                if (areaSelect) {
                    const option = document.createElement('option');
                    option.value = newAreaId;
                    option.textContent = moduleFromDB.areaName + ' (30 LP)';
                    areaSelect.appendChild(option);
                    areaSelect.value = newAreaId;
                }
            }
        }
        
        courses.push({ 
            id: moduleId,
            title, 
            areaId, 
            semester,
            creditPoints,
            description: description || (moduleFromDB ? moduleFromDB.description : ''),
            link: link || (moduleFromDB ? moduleFromDB.link : ''),
            responsible: responsible || (moduleFromDB ? moduleFromDB.responsible : ''),
            examType: examType || (moduleFromDB ? moduleFromDB.examType : 'schriftlich'),
            language: language || (moduleFromDB ? moduleFromDB.language : 'de'),
            department: department || (moduleFromDB ? moduleFromDB.department : ''),
            semester_offered: semesterOffered || (moduleFromDB ? moduleFromDB.semester_offered : 'Beides'),
            type: finalTypes
        });
        
        // Formular zurücksetzen
        document.getElementById('addModuleForm').reset();
        
        // Reset to default values
        document.getElementById('moduleCreditPointsInput').value = '6';
        document.getElementById('moduleExamTypeInput').value = 'schriftlich';
        document.getElementById('moduleLanguageSelect').value = 'de';
        document.getElementById('moduleSemesterOfferedSelect').value = 'Beides';
        document.getElementById('moduleSemesterInput').value = '1';
        
        saveToLocalStorage();
        renderAreas();
    }
}

// Modul bearbeiten with improved modal
function editModule(moduleId) {
    const moduleIndex = courses.findIndex(module => module.id === moduleId);
    if (moduleIndex === -1) return;
    
    const module = courses[moduleIndex];
    
    // Use the modal instead of prompts
    openModuleEditModal(module);
}

function openModuleEditModal(module, isDbModule = false) {
    const modal = document.getElementById('moduleEditModal');
    
    // Store module type and ID as data attributes on the modal
    modal.setAttribute('data-is-db-module', isDbModule ? 'true' : 'false');
    modal.setAttribute('data-module-id', module.id);
    
    // Fill common fields
    document.getElementById('editModuleId').value = module.id;
    document.getElementById('editModuleTitle').value = module.title;
    document.getElementById('editModuleLP').value = module.creditPoints;
    
    // Show different fields based on module type
    const semesterField = document.getElementById('editModuleSemester');
    const semesterContainer = semesterField ? semesterField.closest('.grid > div') : null;
    
    if (isDbModule) {
        // Database module - hide semester field
        if (semesterContainer) semesterContainer.classList.add('hidden');
        
        // For database modules, convert area select to text input if needed
        const areaField = document.getElementById('editModuleArea');
        if (areaField && areaField.tagName === 'SELECT') {
            const areaContainer = areaField.closest('.grid > div');
            const label = areaContainer.querySelector('label');
            
            // Create area text input
            const areaInput = document.createElement('input');
            areaInput.type = 'text';
            areaInput.id = 'editModuleArea';
            areaInput.className = 'border p-2 w-full rounded';
            areaInput.placeholder = 'Bereich zuordnen';
            areaInput.value = module.areaName || '';
            areaInput.required = false; // Not required for database modules
            
            // Replace select with input
            areaField.parentNode.replaceChild(areaInput, areaField);
        } else if (areaField && areaField.tagName === 'INPUT') {
            areaField.value = module.areaName || '';
        }
    } else {
        // Course module - show semester field
        if (semesterContainer) semesterContainer.classList.remove('hidden');
        document.getElementById('editModuleSemester').value = module.semester;
        
        // For course modules, convert area input to select if needed
        const areaField = document.getElementById('editModuleArea');
        if (areaField && areaField.tagName === 'INPUT') {
            const areaContainer = areaField.closest('.grid > div');
            const label = areaContainer.querySelector('label');
            
            // Create area select
            const areaSelect = document.createElement('select');
            areaSelect.id = 'editModuleArea';
            areaSelect.className = 'border p-2 w-full rounded';
            areaSelect.required = true;
            
            // Add options
            areaSelect.innerHTML = '<option value="">Bitte wählen</option>';
            areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                option.selected = area.id === module.areaId;
                areaSelect.appendChild(option);
            });
            
            // Replace input with select
            areaField.parentNode.replaceChild(areaSelect, areaField);
        } else if (areaField && areaField.tagName === 'SELECT') {
            // Update options in existing select
            areaField.innerHTML = '<option value="">Bitte wählen</option>';
            areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                option.selected = area.id === module.areaId;
                areaField.appendChild(option);
            });
        }
    }
    
    // Fill other common fields
    if (document.getElementById('editModuleExamType')) 
        document.getElementById('editModuleExamType').value = module.examType || 'schriftlich';
    if (document.getElementById('editModuleLanguage')) 
        document.getElementById('editModuleLanguage').value = module.language || 'de';
    if (document.getElementById('editModuleOffered')) 
        document.getElementById('editModuleOffered').value = module.semester_offered || '';
    
    // Fill in course-specific fields if they exist
    if (!isDbModule) {
        if (document.getElementById('editModuleResponsible')) 
            document.getElementById('editModuleResponsible').value = module.responsible || '';
        if (document.getElementById('editModuleDepartment')) 
            document.getElementById('editModuleDepartment').value = module.department || '';
            
        // Set module types in checkboxes
        const typeCheckboxes = document.querySelectorAll('input[name="editModuleType"]');
        if (typeCheckboxes) {
            typeCheckboxes.forEach(cb => {
                cb.checked = module.type && module.type.includes(cb.value);
            });
        }
    }
    
    // Show the modal
    modal.classList.remove('hidden');
}

function saveModuleEditChanges(e) {
    if (e) e.preventDefault();
    
    const modal = document.getElementById('moduleEditModal');
    const isDbModule = modal.getAttribute('data-is-db-module') === 'true';
    const moduleId = modal.getAttribute('data-module-id');
    
    // Common fields for both module types
    const newTitle = document.getElementById('editModuleTitle').value.trim();
    const newLP = parseInt(document.getElementById('editModuleLP').value);
    const newExamType = document.getElementById('editModuleExamType').value;
    const newLanguage = document.getElementById('editModuleLanguage').value;
    const newOffered = document.getElementById('editModuleOffered').value;
    
    if (!newTitle || newLP <= 0) {
        alert('Bitte alle Pflichtfelder ausfüllen.');
        return;
    }
    
    if (isDbModule) {
        // Handle database module update
        const areaName = document.getElementById('editModuleArea').value.trim();
        
        const updatedData = {
            title: newTitle,
            creditPoints: newLP,
            examType: newExamType,
            language: newLanguage,
            semester_offered: newOffered,
            areaName: areaName
        };
        
        // Update in the database
        if (window.moduleDatabase.updateModuleInDatabase(moduleId, updatedData)) {
            updateModuleDatabaseTable();
            updateModuleDatabaseCount();
            closeModuleEditModal();
        }
    } else {
        // Handle course module update
        const newSemester = parseInt(document.getElementById('editModuleSemester').value);
        const newAreaId = document.getElementById('editModuleArea').value;
        
        if (!newSemester || !newAreaId) {
            alert('Bitte Semester und Bereich auswählen.');
            return;
        }
        
        // Optional fields for course modules
        const newResponsible = document.getElementById('editModuleResponsible')?.value.trim() || '';
        const newDepartment = document.getElementById('editModuleDepartment')?.value.trim() || '';
        
        // Get module types
        const typeCheckboxes = document.querySelectorAll('input[name="editModuleType"]:checked');
        const selectedTypes = Array.from(typeCheckboxes).map(cb => cb.value);
        const finalTypes = selectedTypes.length > 0 ? selectedTypes : ['VL']; // Default to VL
        
        // Find and update the course module
        const moduleIndex = courses.findIndex(m => m.id === moduleId);
        if (moduleIndex !== -1) {
            courses[moduleIndex] = {
                ...courses[moduleIndex],
                title: newTitle,
                creditPoints: newLP,
                semester: newSemester,
                areaId: newAreaId,
                examType: newExamType,
                language: newLanguage,
                responsible: newResponsible,
                department: newDepartment,
                semester_offered: newOffered,
                type: finalTypes
            };
            
            // Store responsible and department in autocomplete lists
            if (newResponsible && !responsiblePersons.includes(newResponsible)) {
                responsiblePersons.push(newResponsible);
                localStorage.setItem('responsiblePersons', JSON.stringify(responsiblePersons));
            }
            
            if (newDepartment && !departments.includes(newDepartment)) {
                departments.push(newDepartment);
                localStorage.setItem('departments', JSON.stringify(departments));
            }
            
            saveToLocalStorage();
            renderAreas();
            closeModuleEditModal();
        }
    }
}

function closeModuleEditModal() {
    const modal = document.getElementById('moduleEditModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Modul entfernen
function removeModule(moduleId) {
    courses = courses.filter(module => module.id !== moduleId);
    saveToLocalStorage();
    renderAreas();
}

// Speichern in Local Storage
function saveToLocalStorage() {
    try {
        // Clean up data before saving
        const cleanedAreas = areas.map(area => {
            return {
                ...area,
                id: area.id ? area.id : ('area_' + cleanAreaName(area.name).replace(/\s+/g, '_'))
            };
        });
        
        localStorage.setItem('areas', JSON.stringify(cleanedAreas));
        localStorage.setItem('modules', JSON.stringify(courses));
        
        // Also save responsible persons and departments
        if (responsiblePersons.length > 0) {
            localStorage.setItem('responsiblePersons', JSON.stringify(responsiblePersons));
        }
        
        if (departments.length > 0) {
            localStorage.setItem('departments', JSON.stringify(departments));
        }
        
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        alert('Fehler beim Speichern: Der lokale Speicher könnte voll sein.');
        return false;
    }
}

// Laden aus Local Storage
function loadFromLocalStorage() {
    try {
        // Clear arrays first to avoid duplications
        areas = [];
        courses = [];
        responsiblePersons = [];
        departments = [];
        
        const storedAreas = localStorage.getItem('areas');
        const storedModules = localStorage.getItem('modules');
        const storedResponsible = localStorage.getItem('responsiblePersons');
        const storedDepartments = localStorage.getItem('departments');

        if (storedAreas) {
            const parsedAreas = JSON.parse(storedAreas);
            areas = parsedAreas.map(area => {
                // Ensure ID is properly formatted
                const cleanName = cleanAreaName(area.name).replace(/\s+/g, '_');
                return {
                    ...area,
                    id: area.id ? area.id : ('area_' + cleanName)
                };
            });
        }
        
        if (storedModules) {
            courses = JSON.parse(storedModules);
        }
        
        if (storedResponsible) {
            responsiblePersons = JSON.parse(storedResponsible);
        }
        
        if (storedDepartments) {
            departments = JSON.parse(storedDepartments);
        }
        
        return true;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        alert('Fehler beim Laden der Daten.');
        return false;
    }
}

// Autocomplete für Modultitel
function setupModuleAutocomplete() {
    const moduleTitleInput = document.getElementById('moduleTitleInput');
    const moduleDatabase = window.moduleDatabase.loadModuleDatabase();
    
    // If there's no module database, don't setup autocomplete
    if (!moduleDatabase || moduleDatabase.length === 0) return;
    
    // Add event listener for input changes
    moduleTitleInput.addEventListener('input', function() {
        const inputValue = this.value.trim().toLowerCase();
        if (inputValue.length < 2) {
            hideAutocompleteResults();
            return;
        }
        
        // Search for matching modules
        const matches = findMatchingModules(inputValue, moduleDatabase);
        displayAutocompleteResults(matches, inputValue);
    });
    
    // Add a container for autocomplete results if it doesn't exist
    if (!document.getElementById('moduleAutocompleteResults')) {
        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.id = 'moduleAutocompleteResults';
        autocompleteContainer.className = 'absolute z-10 bg-white border shadow-lg rounded-md w-full max-h-60 overflow-y-auto hidden';
        moduleTitleInput.parentNode.style.position = 'relative';
        moduleTitleInput.parentNode.appendChild(autocompleteContainer);
    }
    
    // Close autocomplete when clicking outside
    document.addEventListener('click', function(event) {
        const resultsContainer = document.getElementById('moduleAutocompleteResults');
        if (resultsContainer && !resultsContainer.contains(event.target) && !moduleTitleInput.contains(event.target)) {
            hideAutocompleteResults();
        }
    });
}

function findMatchingModules(query, moduleDatabase) {
    // First try exact matches
    const exactMatches = moduleDatabase.filter(module => 
        module.title.toLowerCase().includes(query)
    );
    
    // If we have at least one exact match, return those
    if (exactMatches.length > 0) {
        return exactMatches.slice(0, 10); // Limit to 10 results
    }
    
    // Otherwise try fuzzy matching
    return moduleDatabase.filter(module => {
        const title = module.title.toLowerCase();
        const queryWords = query.split(/\s+/);
        return queryWords.every(word => title.includes(word));
    }).slice(0, 10); // Limit to 10 results
}

function displayAutocompleteResults(matches, inputValue) {
    const resultsContainer = document.getElementById('moduleAutocompleteResults');
    
    if (!matches.length) {
        hideAutocompleteResults();
        return;
    }
    
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('hidden');
    
    matches.forEach(module => {
        const resultItem = document.createElement('div');
        resultItem.className = 'p-2 hover:bg-gray-100 cursor-pointer border-b';
        
        // Highlight the matching part
        const titleHtml = module.title.replace(
            new RegExp(inputValue.split(/\s+/).join('|'), 'gi'),
            match => `<strong class="bg-yellow-200">${match}</strong>`
        );
        
        resultItem.innerHTML = `
            <div class="font-medium">${titleHtml}</div>
            <div class="text-xs text-gray-600 flex justify-between">
                <span>${module.creditPoints} LP | ${module.examType}</span>
                <span>${module.semester_offered || 'Beides'}</span>
            </div>
        `;
        
        resultItem.addEventListener('click', function() {
            // Fill all form fields with module data
            fillModuleFormWithData(module);
            hideAutocompleteResults();
        });
        
        resultsContainer.appendChild(resultItem);
    });
}

function hideAutocompleteResults() {
    const resultsContainer = document.getElementById('moduleAutocompleteResults');
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
    }
}

function fillModuleFormWithData(module) {
    document.getElementById('moduleTitleInput').value = module.title;
    document.getElementById('moduleCreditPointsInput').value = module.creditPoints;
    
    // Try to select the right exam type from the dropdown
    const examTypeSelect = document.getElementById('moduleExamTypeInput');
    if (examTypeSelect) {
        const options = Array.from(examTypeSelect.options);
        const matchingOption = options.find(option => 
            option.value.toLowerCase() === module.examType.toLowerCase()
        );
        
        if (matchingOption) {
            examTypeSelect.value = matchingOption.value;
        } else {
            examTypeSelect.value = 'schriftlich'; // Default
        }
    }
    
    // Try to select the right language
    const languageSelect = document.getElementById('moduleLanguageSelect');
    if (languageSelect && module.language) {
        const options = Array.from(languageSelect.options);
        const matchingOption = options.find(option => option.value === module.language);
        
        if (matchingOption) {
            languageSelect.value = matchingOption.value;
        }
    }
    
    // Try to select the right semester offered
    const semesterOfferedSelect = document.getElementById('moduleSemesterOfferedSelect');
    if (semesterOfferedSelect && module.semester_offered) {
        const options = Array.from(semesterOfferedSelect.options);
        const matchingOption = options.find(option => 
            option.value === module.semester_offered
        );
        
        if (matchingOption) {
            semesterOfferedSelect.value = matchingOption.value;
        }
    }
    
    // Optional fields
    if (module.description) document.getElementById('moduleDescriptionInput').value = module.description;
    if (module.responsible) document.getElementById('moduleResponsibleInput').value = module.responsible;
    if (module.department) document.getElementById('moduleDepartmentInput').value = module.department;
    if (module.link) document.getElementById('moduleLinkInput').value = module.link;
    
    // Check module types
    const typeCheckboxes = document.querySelectorAll('input[name="moduleType"]');
    typeCheckboxes.forEach(checkbox => {
        checkbox.checked = module.type && module.type.includes(checkbox.value);
    });
}

function loadModuleDatabase() {
    return window.moduleDatabase.loadModuleDatabase();
}

// Save to file
async function saveToFile() {
    window.importExport.exportStudyPlan(areas, courses);
}

// Import study plan from file
async function importStudyPlan() {
    try {
        const data = await window.importExport.importStudyPlan();
        
        if (!data) return; // User cancelled or error
        
        if (confirm('Soll der aktuelle Studienplan überschrieben werden? Dies kann nicht rückgängig gemacht werden?')) {
            // Clear existing data
            areas = data.areas || [];
            courses = data.modules || [];
            
            // Clean up area IDs to ensure consistency
            areas = areas.map(area => {
                return {
                    ...area,
                    id: area.id ? area.id : ('area_' + cleanAreaName(area.name).replace(/\s+/g, '_'))
                };
            });
            
            // Save to localStorage
            saveToLocalStorage();
            
            // Re-render everything
            renderAreas();
            
            alert('Studienplan erfolgreich importiert!');
        }
    } catch (error) {
        console.error('Error importing study plan:', error);
        alert('Fehler beim Importieren: ' + error.message);
    }
}

// Setup autocomplete for area input
function setupAreaAutocomplete() {
    const areaInput = document.getElementById('areaInput');
    if (!areaInput) return;
    
    const storedAreas = JSON.parse(localStorage.getItem('storedAreas') || '[]');
    const scrapedAreas = JSON.parse(localStorage.getItem('scrapedAreas') || '[]');
    
    // Combine stored and scraped areas
    const allAreas = [...storedAreas];
    scrapedAreas.forEach(scrapedArea => {
        if (!allAreas.some(a => cleanAreaName(a.name) === cleanAreaName(scrapedArea.name))) {
            allAreas.push(scrapedArea);
        }
    });
    
    // If there are no areas, don't setup autocomplete
    if (allAreas.length === 0) return;
    
    // Add event listener for input changes
    areaInput.addEventListener('input', function() {
        const inputValue = this.value.trim().toLowerCase();
        if (inputValue.length < 2) {
            hideAreaAutocompleteResults();
            return;
        }
        
        // Search for matching areas
        const matches = allAreas.filter(area => 
            cleanAreaName(area.name).includes(inputValue)
        );
        
        displayAreaAutocompleteResults(matches, inputValue);
    });
    
    // Add a container for autocomplete results if it doesn't exist
    if (!document.getElementById('areaAutocompleteResults')) {
        const autocompleteContainer = document.createElement('div');
        autocompleteContainer.id = 'areaAutocompleteResults';
        autocompleteContainer.className = 'absolute z-10 bg-white border shadow-lg rounded-md w-full max-h-60 overflow-y-auto hidden';
        areaInput.parentNode.style.position = 'relative';
        areaInput.parentNode.appendChild(autocompleteContainer);
    }
    
    // Close autocomplete when clicking outside
    document.addEventListener('click', function(event) {
        const resultsContainer = document.getElementById('areaAutocompleteResults');
        if (resultsContainer && !resultsContainer.contains(event.target) && !areaInput.contains(event.target)) {
            hideAreaAutocompleteResults();
        }
    });
}

function displayAreaAutocompleteResults(matches, inputValue) {
    const resultsContainer = document.getElementById('areaAutocompleteResults');
    
    if (!matches || !matches.length) {
        hideAreaAutocompleteResults();
        return;
    }
    
    resultsContainer.innerHTML = '';
    resultsContainer.classList.remove('hidden');
    
    matches.forEach(area => {
        const resultItem = document.createElement('div');
        resultItem.className = 'p-2 hover:bg-gray-100 cursor-pointer border-b';
        
        // Highlight the matching part
        const nameHtml = area.name.replace(
            new RegExp(inputValue, 'gi'),
            match => `<strong class="bg-yellow-200">${match}</strong>`
        );
        
        resultItem.innerHTML = `
            <div class="font-medium">${nameHtml}</div>
            <div class="text-xs text-gray-600">${area.creditPoints} LP</div>
        `;
        
        resultItem.addEventListener('click', function() {
            document.getElementById('areaInput').value = area.name;
            document.getElementById('areaCreditPointsInput').value = area.creditPoints;
            hideAreaAutocompleteResults();
        });
        
        resultsContainer.appendChild(resultItem);
    });
}

function hideAreaAutocompleteResults() {
    const resultsContainer = document.getElementById('areaAutocompleteResults');
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
    }
}

// Setup autocomplete for responsible person input
function setupResponsibleAutocomplete() {
    const responsibleInput = document.getElementById('moduleResponsibleInput');
    if (!responsibleInput || responsiblePersons.length === 0) return;
    
    setupAutocompleteFor(responsibleInput, 'responsibleAutocompleteResults', responsiblePersons);
}

// Setup autocomplete for department input
function setupDepartmentAutocomplete() {
    const departmentInput = document.getElementById('moduleDepartmentInput');
    if (!departmentInput || departments.length === 0) return;
    
    setupAutocompleteFor(departmentInput, 'departmentAutocompleteResults', departments);
}

// Function to close the database module edit modal
function closeDbModuleEditModal() {
    const modal = document.getElementById('moduleEditModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Function to set up autocomplete for a given input element
function setupAutocompleteFor(input, resultsId, dataArray) {
    // Create container for results if needed
    let resultsContainer = document.getElementById(resultsId);
    
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.id = resultsId;
        resultsContainer.className = 'absolute z-10 bg-white border shadow-lg rounded-md w-full max-h-40 overflow-y-auto hidden';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(resultsContainer);
    }
    
    // Add event listener for input
    input.addEventListener('input', function() {
        const value = this.value.trim().toLowerCase();
        
        if (value.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }
        
        // Filter matches
        const matches = dataArray.filter(item => 
            item.toLowerCase().includes(value)
        );
        
        if (!matches.length) {
            resultsContainer.classList.add('hidden');
            return;
        }
        
        // Display matches
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('hidden');
        
        matches.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'p-2 hover:bg-gray-100 cursor-pointer';
            
            // Highlight matching part
            const itemHtml = item.replace(
                new RegExp(value, 'gi'),
                match => `<strong class="bg-yellow-200">${match}</strong>`
            );
            
            resultItem.innerHTML = itemHtml;
            
            resultItem.addEventListener('click', function() {
                input.value = item;
                resultsContainer.classList.add('hidden');
            });
            
            resultsContainer.appendChild(resultItem);
        });
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(event) {
        if (!resultsContainer.contains(event.target) && !input.contains(event.target)) {
            resultsContainer.classList.add('hidden');
        }
    });
}

// Initial load function
window.onload = () => {
    // Set default values for forms
    document.getElementById('areaCreditPointsInput').value = '6';
    document.getElementById('moduleExamTypeInput').value = 'schriftlich';
}

// Initiales Laden
window.onload = () => {
    // Set default values for forms
    document.getElementById('areaCreditPointsInput').value = '6';
    document.getElementById('moduleExamTypeInput').value = 'schriftlich';
    document.getElementById('moduleLanguageSelect').value = 'de';
    document.getElementById('moduleSemesterOfferedSelect').value = 'Beides';
    document.getElementById('moduleSemesterInput').value = '1';
    document.getElementById('moduleCreditPointsInput').value = '6';
    
    loadFromLocalStorage();
    setupModuleAutocomplete();
    updateModuleDatabaseCount();
    updateModuleDatabaseTable();
    renderAreas(); // Initiales Rendern
    lucide.createIcons();
    
    // Add event listener for import button
    const importButton = document.getElementById('importButton');
    if (importButton) {
        importButton.addEventListener('click', importStudyPlan);
    }
    
    // Add event listener for export database button
    const exportDatabaseButton = document.getElementById('exportDatabaseButton');
    if (exportDatabaseButton) {
        exportDatabaseButton.addEventListener('click', function() {
            window.importExport.exportModuleDatabase();
        });
    }
    
    // Add event listener for import database button
    const importDatabaseButton = document.getElementById('importDatabaseButton');
    if (importDatabaseButton) {
        importDatabaseButton.addEventListener('click', async function() {
            const modules = await window.importExport.importModuleDatabase();
            if (modules) {
                updateModuleDatabaseCount();
                updateModuleDatabaseTable();
                alert('Moduldatenbank erfolgreich importiert!');
            }
        });
    }
};

function updateModuleDatabaseCount() {
    const moduleDatabase = window.moduleDatabase.loadModuleDatabase();
    const countElement = document.getElementById('moduleDatabaseCount');
    
    if (countElement) {
        countElement.textContent = moduleDatabase.length;
    }
}

function updateModuleDatabaseTable() {
    const tableBody = document.getElementById('moduleDatabaseTable');
    if (!tableBody) return;
    
    const moduleDatabase = window.moduleDatabase.loadModuleDatabase();
    
    if (!moduleDatabase || moduleDatabase.length === 0) {
        tableBody.innerHTML = '<tr><td class="border p-2" colspan="5">Keine Module in der Datenbank</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '';
    
    moduleDatabase.forEach(module => {
        const row = document.createElement('tr');
        
        // Add area tag class if available
        if (module.areaName) {
            row.classList.add('bg-blue-50');
        }
        
        row.innerHTML = `
            <td class="border p-2">
                ${module.link ? 
                    `<a href="${module.link}" target="_blank" class="text-blue-500 hover:underline">${module.title}</a>` : 
                    module.title}
                ${module.areaName ? 
                    `<div class="text-xs mt-1 bg-blue-100 inline-block px-2 py-0.5 rounded-full">${module.areaName}</div>` : 
                    ''}
            </td>
            <td class="border p-2">${module.creditPoints}</td>
            <td class="border p-2">${module.examType}</td>
            <td class="border p-2">${module.semester_offered || 'Beides'}</td>
            <td class="border p-2">
                <div class="flex gap-2">
                    <button class="add-to-plan-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs" 
                            data-title="${module.title}" data-id="${module.id}">
                        <i class="fas fa-plus mr-1"></i>Zum Plan
                    </button>
                    <button class="edit-db-module-btn text-blue-500 hover:text-blue-700" 
                            data-id="${module.id}" data-type="database">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="remove-db-module-btn text-red-500 hover:text-red-700" 
                            data-id="${module.id}" data-type="database">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Use event delegation instead of individual event listeners
    if (!tableBody.hasAttribute('data-listeners-added')) {
        tableBody.setAttribute('data-listeners-added', 'true');
        tableBody.addEventListener('click', handleModuleDatabaseTableClick);
    }
    
    lucide.createIcons();
}

// Event delegation handler for module database table
function handleModuleDatabaseTableClick(event) {
    const button = event.target.closest('button');
    if (!button) return; // Exit if no button was clicked
    
    const moduleId = button.getAttribute('data-id');
    if (!moduleId) return; // Exit if no data-id
    
    const moduleDatabase = window.moduleDatabase.loadModuleDatabase();
    const moduleData = moduleDatabase.find(m => m.id === moduleId);
    
    if (!moduleData) return; // Exit if module not found
    
    if (button.classList.contains('add-to-plan-btn')) {
        // Add to plan button clicked
        document.getElementById('moduleTitleInput').value = moduleData.title;
        document.getElementById('moduleCreditPointsInput').value = moduleData.creditPoints;
        fillModuleFormWithData(moduleData);
        document.getElementById('moduleTitleInput').scrollIntoView({ behavior: 'smooth' });
    }
    else if (button.classList.contains('edit-db-module-btn')) {
        // Edit button clicked
        openModuleEditModal(moduleData, true);
    }
    else if (button.classList.contains('remove-db-module-btn')) {
        // Remove button clicked
        if (confirm('Sind Sie sicher, dass Sie dieses Modul aus der Datenbank löschen möchten?')) {
            if (window.moduleDatabase.removeModuleFromDatabase(moduleId)) {
                updateModuleDatabaseCount();
                updateModuleDatabaseTable();
                alert('Modul erfolgreich aus der Datenbank entfernt.');
            }
        }
    }
}

// Updated to handle both database and course modules
function openModuleEditModal(module, isDbModule = false) {
    const modal = document.getElementById('moduleEditModal');
    
    // Store module type and ID as data attributes on the modal
    modal.setAttribute('data-is-db-module', isDbModule ? 'true' : 'false');
    modal.setAttribute('data-module-id', module.id);
    
    // Fill common fields
    document.getElementById('editModuleId').value = module.id;
    document.getElementById('editModuleTitle').value = module.title;
    document.getElementById('editModuleLP').value = module.creditPoints;
    
    // Show different fields based on module type
    const semesterField = document.getElementById('editModuleSemester');
    const semesterContainer = semesterField ? semesterField.closest('.grid > div') : null;
    
    if (isDbModule) {
        // Database module - hide semester field
        if (semesterContainer) semesterContainer.classList.add('hidden');
        
        // For database modules, convert area select to text input if needed
        const areaField = document.getElementById('editModuleArea');
        if (areaField && areaField.tagName === 'SELECT') {
            const areaContainer = areaField.closest('.grid > div');
            const label = areaContainer.querySelector('label');
            
            // Create area text input
            const areaInput = document.createElement('input');
            areaInput.type = 'text';
            areaInput.id = 'editModuleArea';
            areaInput.className = 'border p-2 w-full rounded';
            areaInput.placeholder = 'Bereich zuordnen';
            areaInput.value = module.areaName || '';
            areaInput.required = false; // Not required for database modules
            
            // Replace select with input
            areaField.parentNode.replaceChild(areaInput, areaField);
        } else if (areaField && areaField.tagName === 'INPUT') {
            areaField.value = module.areaName || '';
        }
    } else {
        // Course module - show semester field
        if (semesterContainer) semesterContainer.classList.remove('hidden');
        document.getElementById('editModuleSemester').value = module.semester;
        
        // For course modules, convert area input to select if needed
        const areaField = document.getElementById('editModuleArea');
        if (areaField && areaField.tagName === 'INPUT') {
            const areaContainer = areaField.closest('.grid > div');
            const label = areaContainer.querySelector('label');
            
            // Create area select
            const areaSelect = document.createElement('select');
            areaSelect.id = 'editModuleArea';
            areaSelect.className = 'border p-2 w-full rounded';
            areaSelect.required = true;
            
            // Add options
            areaSelect.innerHTML = '<option value="">Bitte wählen</option>';
            areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                option.selected = area.id === module.areaId;
                areaSelect.appendChild(option);
            });
            
            // Replace input with select
            areaField.parentNode.replaceChild(areaSelect, areaField);
        } else if (areaField && areaField.tagName === 'SELECT') {
            // Update options in existing select
            areaField.innerHTML = '<option value="">Bitte wählen</option>';
            areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                option.selected = area.id === module.areaId;
                areaField.appendChild(option);
            });
        }
    }
    
    // Fill other common fields
    if (document.getElementById('editModuleExamType')) 
        document.getElementById('editModuleExamType').value = module.examType || 'schriftlich';
    if (document.getElementById('editModuleLanguage')) 
        document.getElementById('editModuleLanguage').value = module.language || 'de';
    if (document.getElementById('editModuleOffered')) 
        document.getElementById('editModuleOffered').value = module.semester_offered || '';
    
    // Fill in course-specific fields if they exist
    if (!isDbModule) {
        if (document.getElementById('editModuleResponsible')) 
            document.getElementById('editModuleResponsible').value = module.responsible || '';
        if (document.getElementById('editModuleDepartment')) 
            document.getElementById('editModuleDepartment').value = module.department || '';
            
        // Set module types in checkboxes
        const typeCheckboxes = document.querySelectorAll('input[name="editModuleType"]');
        if (typeCheckboxes) {
            typeCheckboxes.forEach(cb => {
                cb.checked = module.type && module.type.includes(cb.value);
            });
        }
    }
    
    // Show the modal
    modal.classList.remove('hidden');
}

function saveModuleEditChanges(e) {
    if (e) e.preventDefault();
    
    const modal = document.getElementById('moduleEditModal');
    const isDbModule = modal.getAttribute('data-is-db-module') === 'true';
    const moduleId = modal.getAttribute('data-module-id');
    
    // Common fields for both module types
    const newTitle = document.getElementById('editModuleTitle').value.trim();
    const newLP = parseInt(document.getElementById('editModuleLP').value);
    const newExamType = document.getElementById('editModuleExamType').value;
    const newLanguage = document.getElementById('editModuleLanguage').value;
    const newOffered = document.getElementById('editModuleOffered').value;
    
    if (!newTitle || newLP <= 0) {
        alert('Bitte alle Pflichtfelder ausfüllen.');
        return;
    }
    
    if (isDbModule) {
        // Handle database module update
        const areaName = document.getElementById('editModuleArea').value.trim();
        
        const updatedData = {
            title: newTitle,
            creditPoints: newLP,
            examType: newExamType,
            language: newLanguage,
            semester_offered: newOffered,
            areaName: areaName
        };
        
        // Update in the database
        if (window.moduleDatabase.updateModuleInDatabase(moduleId, updatedData)) {
            updateModuleDatabaseTable();
            updateModuleDatabaseCount();
            closeModuleEditModal();
        }
    } else {
        // Handle course module update
        const newSemester = parseInt(document.getElementById('editModuleSemester').value);
        const newAreaId = document.getElementById('editModuleArea').value;
        
        if (!newSemester || !newAreaId) {
            alert('Bitte Semester und Bereich auswählen.');
            return;
        }
        
        // Optional fields for course modules
        const newResponsible = document.getElementById('editModuleResponsible')?.value.trim() || '';
        const newDepartment = document.getElementById('editModuleDepartment')?.value.trim() || '';
        
        // Get module types
        const typeCheckboxes = document.querySelectorAll('input[name="editModuleType"]:checked');
        const selectedTypes = Array.from(typeCheckboxes).map(cb => cb.value);
        const finalTypes = selectedTypes.length > 0 ? selectedTypes : ['VL']; // Default to VL
        
        // Find and update the course module
        const moduleIndex = courses.findIndex(m => m.id === moduleId);
        if (moduleIndex !== -1) {
            courses[moduleIndex] = {
                ...courses[moduleIndex],
                title: newTitle,
                creditPoints: newLP,
                semester: newSemester,
                areaId: newAreaId,
                examType: newExamType,
                language: newLanguage,
                responsible: newResponsible,
                department: newDepartment,
                semester_offered: newOffered,
                type: finalTypes
            };
            
            // Store responsible and department in autocomplete lists
            if (newResponsible && !responsiblePersons.includes(newResponsible)) {
                responsiblePersons.push(newResponsible);
                localStorage.setItem('responsiblePersons', JSON.stringify(responsiblePersons));
            }
            
            if (newDepartment && !departments.includes(newDepartment)) {
                departments.push(newDepartment);
                localStorage.setItem('departments', JSON.stringify(departments));
            }
            
            saveToLocalStorage();
            renderAreas();
            closeModuleEditModal();
        }
    }
}

function closeModuleEditModal() {
    const modal = document.getElementById('moduleEditModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Save to file
async function saveToFile() {
    const data = {
        areas: areas,
        modules: courses
    };

    const jsonString = JSON.stringify(data, null, 2);

    // Check if the File System Access API is supported
    if ('showSaveFilePicker' in window) {
        const options = {
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
        } catch (error) {
            console.error('Error saving to file:', error);
            fallbackSave(jsonString);
        }
    } else {
        // Fallback for browsers that don't support the File System Access API
        fallbackSave(jsonString);
    }
}

// Fallback save method using Blob and download attribute
function fallbackSave(jsonString) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studyplan.json';
    a.click();
    URL.revokeObjectURL(url);
}