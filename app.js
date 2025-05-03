let areas = [];
let courses = [];
let responsiblePersons = [];
let departments = [];

// Clean area name function - improved to handle trailing numbers and extra whitespace
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

// Save area to database for reuse - updated to use proper IDs
function saveAreaToDatabase(areaName, creditPoints) {
    try {
        const storedAreas = JSON.parse(localStorage.getItem('storedAreas') || '[]');
        
        // Clean area name for comparison and generate a clean ID
        const cleanName = cleanAreaName(areaName);
        const areaId = 'area_' + cleanName.replace(/\s+/g, '_');
        
        // Check if area already exists by comparing cleaned names
        const existingAreaIndex = storedAreas.findIndex(area => 
            cleanAreaName(area.name) === cleanName
        );
        
        if (existingAreaIndex >= 0) {
            // Update existing area
            storedAreas[existingAreaIndex].creditPoints = creditPoints;
        } else {
            // Add new area with ID
            storedAreas.push({
                id: areaId,
                name: areaName.trim(), // Store the original name but trimmed
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
        // Ggf. mehr Farben hinzufügen
    ];
     const semesterIndex = parseInt(semester);
     if (!isNaN(semesterIndex) && semesterIndex > 0) {
        // Verwende /30 für Transparenz
        return tailwindColors[(semesterIndex - 1) % tailwindColors.length] + '/30';
     }
     return 'bg-gray-500/30'; // Fallback
}

// Bereiche rendern
function renderAreas() {
    const areasContainer = document.getElementById('areasContainer');
    const moduleAreaSelect = document.getElementById('moduleAreaSelect');
    const parentAreaSelect = document.getElementById('parentAreaSelect');
    const semesterContainer = document.getElementById('semesterContainer');

    areasContainer.innerHTML = '';
    populateAreaSelect(moduleAreaSelect, true); // Mit "Bitte wählen"
    populateAreaSelect(parentAreaSelect, true); // Mit "Bitte wählen" (für Top-Level)


    function renderAreaHierarchy(parentId = null, level = 0) {
        const filteredAreas = areas.filter(area => area.parentId === parentId);
        filteredAreas.sort((a, b) => a.name.localeCompare(b.name));

        filteredAreas.forEach((area) => {
            // Select-Optionen (unverändert)
             const option = document.createElement('option');
            option.value = area.id;
            const lpText = (area.creditPoints > 0 || !area.parentId) ? ` (${area.creditPoints} LP)` : '';
            option.textContent = '  '.repeat(level) + area.name + lpText;
            moduleAreaSelect.appendChild(option);

            const parentOption = document.createElement('option');
            parentOption.value = area.id;
            parentOption.textContent = '  '.repeat(level) + area.name + lpText;
            parentAreaSelect.appendChild(parentOption);


            // Bereichs-Div (kompakter)
            const areaDiv = document.createElement('div');
            // Weniger Padding/Margin, behalte Rand
             areaDiv.className = 'area-block bg-white rounded-md shadow-sm px-2 py-2 mb-1.5'; // py-2, mb-1.5, shadow-sm
            areaDiv.style.marginLeft = `${level * 20}px`;
             const borderColors = ['border-blue-200', 'border-green-200', 'border-yellow-200', 'border-purple-200', 'border-pink-200'];
            areaDiv.classList.add(borderColors[level % borderColors.length]);


            // Bereichs-Header mit Titel und LP-Nutzung
            const areaHeader = document.createElement('div');
            // items-baseline für bessere Ausrichtung von Text unterschiedlicher Größe
            areaHeader.className = 'flex justify-between items-baseline w-full px-1'; // px-1

            const titleAndUsageContainer = document.createElement('div');
            titleAndUsageContainer.className = 'flex items-baseline gap-x-2'; // gap-x-2

            // Bereichstitel (Standard Schriftgröße)
            const areaTitle = document.createElement('h2');
            const titleLPText = (area.creditPoints > 0 || !area.parentId) ? `(${area.creditPoints} LP)` : '';
            areaTitle.innerText = `${area.name} ${titleLPText}`; // LP-Anzeige direkt dran
            areaTitle.className = 'text-base font-semibold'; // text-base (Standard), font-semibold
            titleAndUsageContainer.appendChild(areaTitle);

            // LP-Nutzung (kleiner daneben)
            const usageLP = calculateAreaUsageLP(area.id);
            const lpUsageDiv = document.createElement('div');
            lpUsageDiv.className = 'text-xs text-gray-500 whitespace-nowrap'; // Kleinere Schrift, kein Umbruch
             const capacityText = (area.creditPoints > 0 || !area.parentId) ? ` / ${area.creditPoints} LP` : ' LP';
             lpUsageDiv.innerHTML = `(${usageLP}${capacityText} genutzt)`; // Kompaktere Darstellung

             // Farbliche Hervorhebung bei Über-/Vollauslastung (nur wenn Kapazität relevant)
            if ((area.creditPoints > 0 || !area.parentId)) {
                if (usageLP > area.creditPoints) {
                    lpUsageDiv.classList.add('text-red-600', 'font-medium');
                    lpUsageDiv.classList.remove('text-gray-500');
                } else if (usageLP === area.creditPoints && area.creditPoints > 0) {
                    lpUsageDiv.classList.add('text-green-600', 'font-medium');
                    lpUsageDiv.classList.remove('text-gray-500');
                }
            }
            titleAndUsageContainer.appendChild(lpUsageDiv);

            areaHeader.appendChild(titleAndUsageContainer);

            // Buttons (kleiner)
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'flex gap-1.5 ml-auto items-center pl-2'; // gap-1.5

            const editButton = document.createElement('button');
            editButton.innerHTML = '<i data-lucide="edit" class="size-3.5"></i>'; // size-3.5
            editButton.classList.add('area-edit-btn', 'text-blue-500', 'hover:text-blue-700');
            editButton.setAttribute('data-id', area.id);
            buttonContainer.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i data-lucide="trash" class="size-3.5"></i>'; // size-3.5
            deleteButton.classList.add('area-delete-btn', 'text-red-500', 'hover:text-red-700');
            deleteButton.setAttribute('data-id', area.id);
            buttonContainer.appendChild(deleteButton);

            areaHeader.appendChild(buttonContainer);
            areaDiv.appendChild(areaHeader);


            // Modul-Liste (kompakter)
            const moduleList = document.createElement('div');
            moduleList.className = 'mt-1.5 space-y-0.5 px-1'; // mt-1.5, space-y-0.5

            const areaModules = courses.filter(module => module.areaId === area.id);
            areaModules.sort((a,b) => a.semester - b.semester || a.title.localeCompare(b.title));

            areaModules.forEach((module) => {
                const moduleDiv = document.createElement('div');
                // Weniger Padding, kein Hintergrund, Border unten
                moduleDiv.className = 'module-item flex justify-between items-center p-1 border-t border-gray-100'; // p-1, border-t
                // Standard Schriftgröße für Titel, kleinere Details

                const moduleInfo = document.createElement('div');
                moduleInfo.className = 'flex flex-col';

                const moduleTitle = document.createElement('span');
                moduleTitle.className = 'font-medium'; // Keine explizite Größenänderung -> Standard
                moduleTitle.innerText = `${module.title} (${module.creditPoints} LP, Sem: ${module.semester})`;
                moduleInfo.appendChild(moduleTitle);

                const moduleDetails = document.createElement('span');
                moduleDetails.className = 'text-xs text-gray-600'; // Details bleiben klein
                 const typeString = module.type && module.type.length > 0 ? module.type.join('/') : '-';
                moduleDetails.innerText = `${typeString} | ${module.examType} | ${module.language} | ${module.semester_offered}`;
                moduleInfo.appendChild(moduleDetails);

                moduleDiv.appendChild(moduleInfo);

                // Modul-Buttons (kleiner)
                const moduleButtonContainer = document.createElement('div');
                moduleButtonContainer.className = 'flex gap-1.5 ml-auto items-center pl-2'; // gap-1.5

                const moduleEditButton = document.createElement('button');
                moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-3.5"></i>'; // size-3.5
                moduleEditButton.classList.add('module-edit-btn', 'text-blue-500', 'hover:text-blue-700');
                moduleEditButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleEditButton);

                const moduleDeleteButton = document.createElement('button');
                moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-3.5"></i>'; // size-3.5
                moduleDeleteButton.classList.add('module-delete-btn', 'text-red-500', 'hover:text-red-700');
                moduleDeleteButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleDeleteButton);

                moduleDiv.appendChild(moduleButtonContainer);
                moduleList.appendChild(moduleDiv);
            });

            areaDiv.appendChild(moduleList);
            areasContainer.appendChild(areaDiv);

            renderAreaHierarchy(area.id, level + 1);
        });
    }

    renderAreaHierarchy(null);
    updateSemesterView(); // Aktualisiert auch Gesamt-LP
    lucide.createIcons();

    // Event delegation (unverändert, aber wichtig)
    if (areasContainer && !areasContainer.hasAttribute('data-listeners-added')) {
        areasContainer.setAttribute('data-listeners-added', 'true');
        areasContainer.addEventListener('click', function(event) {
             const button = event.target.closest('button[data-id]'); // Nur Buttons mit data-id
            if (!button) return;

            const id = button.getAttribute('data-id');

            if (button.classList.contains('module-edit-btn')) {
                const module = courses.find(m => m.id === id);
                if (module) openModuleEditModal(module, false);
            } else if (button.classList.contains('module-delete-btn')) {
                if (confirm('Sind Sie sicher, dass Sie dieses Modul entfernen möchten?')) {
                    removeModule(id);
                }
            } else if (button.classList.contains('area-edit-btn')) {
                 const area = areas.find(a => a.id === id);
                 if (area) openAreaEditModal(area); // Direkter Aufruf
            } else if (button.classList.contains('area-delete-btn')) {
                if (confirm('Sind Sie sicher, dass Sie diesen Bereich und alle seine Unterbereiche/Module entfernen möchten?')) {
                    removeArea(id);
                }
            }
        });
    }
    // Event delegation für Semester Container (unverändert)
    if (semesterContainer && !semesterContainer.hasAttribute('data-listeners-added')) {
         semesterContainer.setAttribute('data-listeners-added', 'true');
        semesterContainer.addEventListener('click', function(event) {
            const button = event.target.closest('button[data-id]');
             if (!button) return;
             const moduleId = button.getAttribute('data-id');

             if (button.classList.contains('module-edit-btn')) {
                 const module = courses.find(m => m.id === moduleId);
                 if (module) openModuleEditModal(module, false);
            } else if (button.classList.contains('module-delete-btn')) {
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

    const sortedModules = courses.slice().sort((a, b) => a.semester - b.semester || a.title.localeCompare(b.title));
    const modulesBySemester = sortedModules.reduce((acc, module) => {
        (acc[module.semester] = acc[module.semester] || []).push(module);
        return acc;
    }, {});

    let totalStudyPlanLPs = 0;

    Object.entries(modulesBySemester)
        .sort(([semA], [semB]) => parseInt(semA) - parseInt(semB))
        .forEach(([semester, modules]) => {
            const semesterDiv = document.createElement('div');
             // Weniger Padding, kein Shadow, nur Hintergrundfarbe, weniger Margin
            semesterDiv.className = `p-2 rounded-md mb-2 ${generateColor(semester)}`;

            const totalLP = modules.reduce((sum, module) => sum + module.creditPoints, 0);
            totalStudyPlanLPs += totalLP;

            const semesterHeader = document.createElement('div');
            semesterHeader.className = 'flex justify-between items-center mb-1.5'; // mb-1.5

            const semesterTitle = document.createElement('h3');
            semesterTitle.innerText = `Semester ${semester}`;
            semesterTitle.className = 'text-lg font-semibold'; // text-lg, font-semibold
            semesterHeader.appendChild(semesterTitle);

            const lpCounter = document.createElement('span');
            lpCounter.className = 'py-0.5 px-2 rounded-full text-xs font-bold'; // Kleineres Padding/Schrift
            lpCounter.innerText = `${totalLP} LP`;
             // Farben für LP-Bereich (unverändert)
             if (totalLP < 25) {
                lpCounter.classList.add('bg-yellow-200', 'text-yellow-800');
            } else if (totalLP > 33) {
                lpCounter.classList.add('bg-red-200', 'text-red-800');
            } else {
                lpCounter.classList.add('bg-green-200', 'text-green-800');
            }
            semesterHeader.appendChild(lpCounter);
            semesterDiv.appendChild(semesterHeader);

            // Modulliste innerhalb des Semesters
            const semesterModuleList = document.createElement('div');
            semesterModuleList.className = 'space-y-0.5'; // Kompakter Abstand

            modules.forEach((module) => {
                const moduleDiv = document.createElement('div');
                 // Kompakteres Padding, Border unten, kein Hintergrund/Schatten
                moduleDiv.className = 'module-item flex justify-between items-center py-1 px-1.5 border-b border-gray-400/30 last:border-b-0'; // py-1, px-1.5, border-b, last:border-b-0

                const moduleArea = areas.find(area => area.id === module.areaId);
                const areaName = moduleArea ? moduleArea.name : "k. Bereich"; // Kürzer

                const moduleInfo = document.createElement('div');
                moduleInfo.className = 'flex flex-col';

                // Titel normale Größe
                const moduleTitle = document.createElement('span');
                moduleTitle.className = 'font-medium leading-tight'; // Normale Größe, engerer Zeilenabstand
                moduleTitle.innerText = `${module.title} (${module.creditPoints} LP)`;
                moduleInfo.appendChild(moduleTitle);

                // Details klein
                const moduleDetails = document.createElement('span');
                moduleDetails.className = 'text-xs text-gray-600';
                 const typeString = module.type && module.type.length > 0 ? module.type.join('/') : '-';
                moduleDetails.innerText = `${areaName} | ${typeString} | ${module.examType}`;
                moduleInfo.appendChild(moduleDetails);

                moduleDiv.appendChild(moduleInfo);

                // Buttons klein
                const moduleButtonContainer = document.createElement('div');
                moduleButtonContainer.className = 'flex gap-1.5 ml-auto items-center pl-2'; // gap-1.5

                const moduleEditButton = document.createElement('button');
                moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-3.5"></i>'; // size-3.5
                moduleEditButton.classList.add('module-edit-btn', 'text-blue-600', 'hover:text-blue-800');
                moduleEditButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleEditButton);

                const moduleDeleteButton = document.createElement('button');
                moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-3.5"></i>'; // size-3.5
                moduleDeleteButton.classList.add('module-delete-btn', 'text-red-600', 'hover:text-red-800');
                moduleDeleteButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleDeleteButton);

                moduleDiv.appendChild(moduleButtonContainer);
                semesterModuleList.appendChild(moduleDiv); // Füge Modul zur Liste hinzu
            });
             semesterDiv.appendChild(semesterModuleList); // Füge Liste zum Semester-Div hinzu
            semesterContainer.appendChild(semesterDiv);
        });

    const totalLPSpan = document.getElementById('totalSemesterLPs');
    if (totalLPSpan) {
        totalLPSpan.textContent = `(Gesamt: ${totalStudyPlanLPs} LP)`;
    }
}

// Rekursive Funktion zur Berechnung der verwendeten LP in einem Bereich und seinen Unterbereichen
function calculateAreaUsageLP(targetAreaId) {
    // 1. LPs von Modulen, die direkt diesem Bereich zugeordnet sind
    const directModules = courses.filter(module => module.areaId === targetAreaId);
    let usageLP = directModules.reduce((sum, module) => sum + module.creditPoints, 0);

    // 2. LPs, die rekursiv in direkten Kindbereichen verwendet werden
    const childAreas = areas.filter(area => area.parentId === targetAreaId);
    childAreas.forEach(childArea => {
        // Addiere die USAGE (nicht die Kapazität) der Kindbereiche hinzu
        usageLP += calculateAreaUsageLP(childArea.id);
    });

    return usageLP;
}

// Bereich hinzufügen - updated with improved area name cleaning
function addArea() {
    const areaInput = document.getElementById('areaInput');
    const lpInput = document.getElementById('areaCreditPointsInput');
    const parentSelect = document.getElementById('parentAreaSelect');

    const areaInputError = document.getElementById('areaInputError');
    const areaCreditPointsError = document.getElementById('areaCreditPointsError');
    areaInputError.classList.add('hidden');
    areaCreditPointsError.classList.add('hidden');

    const newAreaName = areaInput.value.trim();
    const parentId = parentSelect.value || null;
    let creditPoints = parseInt(lpInput.value);

    // Standardisiere auf 0 wenn leer oder NaN
    if (isNaN(creditPoints)) {
        creditPoints = 0;
    }

    let isValid = true;

    if (!newAreaName) {
        areaInputError.textContent = 'Bitte geben Sie einen Bereichsnamen ein.';
        areaInputError.classList.remove('hidden');
        isValid = false;
    }

    // Validierung: LP dürfen nicht negativ sein
    if (creditPoints < 0) {
        areaCreditPointsError.textContent = 'Leistungspunkte dürfen nicht negativ sein.';
        areaCreditPointsError.classList.remove('hidden');
        isValid = false;
    }


    if (isValid) {
        const cleanName = cleanAreaName(newAreaName).replace(/\s+/g, '_');
        const areaId = 'area_' + cleanName + '_' + Date.now(); // Eindeutiger machen

        const existingArea = areas.find(area =>
            cleanAreaName(area.name) === cleanAreaName(newAreaName) && area.parentId === parentId
        );

        if (existingArea) {
             if (confirm(`Ein Bereich mit dem Namen "${existingArea.name}" existiert bereits auf dieser Ebene. Möchten Sie diesen bearbeiten?`)) {
                openAreaEditModal(existingArea);
                return;
            } else {
                 return;
            }
        }

        areas.push({
            id: areaId,
            name: newAreaName,
            creditPoints: creditPoints, // Speichere den Wert (kann 0 sein)
            parentId: parentId
        });

        saveAreaToDatabase(newAreaName, creditPoints);

        areaInput.value = '';
        lpInput.value = '6'; // Reset input field to default
        parentSelect.value = '';

        saveToLocalStorage();
        renderAreas();
    }
}

// Bereich bearbeiten with improved modal
function editArea(areaId) { // Diese Funktion wird jetzt weniger genutzt, openAreaEditModal direkt aufrufen
    const area = areas.find(area => area.id === areaId);
    if (!area) return;
    openAreaEditModal(area); // Ruft die geänderte Funktion auf
}

function openAreaEditModal(area) {
    const areaIndex = areas.findIndex(a => a.id === area.id); // Finde Index für Speichern
    if (areaIndex === -1) return;

    document.getElementById('editAreaId').value = area.id;
    document.getElementById('editAreaName').value = area.name;
    document.getElementById('editAreaLP').value = area.creditPoints;

    const parentSelect = document.getElementById('editAreaParent');
    populateAreaSelect(parentSelect, true, area.id, area.parentId);

    const possibleParents = areas.filter(a => {
        if (a.id === area.id) return false;
        let currentParentId = a.parentId;
        while (currentParentId) {
            if (currentParentId === area.id) return false;
            const parentArea = areas.find(pa => pa.id === currentParentId);
            currentParentId = parentArea ? parentArea.parentId : null;
        }
        return true;
    });

    possibleParents.sort((a,b) => a.name.localeCompare(b.name)); // Sortieren
    possibleParents.forEach(a => {
        const option = document.createElement('option');
        option.value = a.id;
        // Hierarchie andeuten (optional, kann komplex werden)
        let level = 0;
        let tempParentId = a.parentId;
        while(tempParentId) {
            level++;
            const tempParent = areas.find(p => p.id === tempParentId);
            tempParentId = tempParent ? tempParent.parentId : null;
        }
        option.textContent = '  '.repeat(level) + a.name;
        option.selected = a.id === area.parentId;
        parentSelect.appendChild(option);
    });

    const modal = document.getElementById('areaEditModal');
    modal.classList.remove('hidden');

    // Submit-Handler
    document.getElementById('editAreaForm').onsubmit = function(e) {
        e.preventDefault();
        const areaId = document.getElementById('editAreaId').value;
        const currentAreaIndex = areas.findIndex(a => a.id === areaId);
         if (currentAreaIndex === -1) {
             console.error("Fehler: Bereich zum Bearbeiten nicht gefunden.");
             closeAreaEditModal();
             return;
         }

        const newName = document.getElementById('editAreaName').value.trim();
        let newLP = parseInt(document.getElementById('editAreaLP').value);
        const newParentId = document.getElementById('editAreaParent').value || null;
        const lpErrorField = document.getElementById('editAreaLPError');
        lpErrorField.classList.add('hidden');

        // Standardisiere auf 0 wenn leer oder NaN
        if (isNaN(newLP)) {
             newLP = 0;
        }

        let saveIsValid = true;
        if (!newName) {
            alert('Bitte geben Sie einen Namen für den Bereich ein.');
            saveIsValid = false;
        }
        // Validierung: LP dürfen nicht negativ sein
        else if (newLP < 0) {
             lpErrorField.textContent = 'LP dürfen nicht negativ sein.';
             lpErrorField.classList.remove('hidden');
            saveIsValid = false;
        }

        if (saveIsValid) {
            areas[currentAreaIndex] = {
                ...areas[currentAreaIndex],
                name: newName,
                creditPoints: newLP, // Speichert den Wert (kann 0 sein)
                parentId: newParentId
            };

            saveAreaToDatabase(newName, newLP);
            saveToLocalStorage();
            renderAreas();
            closeAreaEditModal();
        }
    };
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
// window.onload = () => {
//     // Set default values for forms
//     document.getElementById('areaCreditPointsInput').value = '6';
//     document.getElementById('moduleExamTypeInput').value = 'schriftlich';
// }

// // Initiales Laden
// window.onload = () => {
//     // Set default values for forms
//     document.getElementById('areaCreditPointsInput').value = '6';
//     document.getElementById('moduleExamTypeInput').value = 'schriftlich';
//     document.getElementById('moduleLanguageSelect').value = 'de';
//     document.getElementById('moduleSemesterOfferedSelect').value = 'Beides';
//     document.getElementById('moduleSemesterInput').value = '1';
//     document.getElementById('moduleCreditPointsInput').value = '6';
    
//     loadFromLocalStorage();
//     setupModuleAutocomplete();
//     updateModuleDatabaseCount();
//     updateModuleDatabaseTable();
//     renderAreas(); // Initiales Rendern
//     lucide.createIcons();
    
//     // Add event listener for import button
//     const importButton = document.getElementById('importButton');
//     if (importButton) {
//         importButton.addEventListener('click', importStudyPlan);
//     }
    
//     // Add event listener for export database button
//     const exportDatabaseButton = document.getElementById('exportDatabaseButton');
//     if (exportDatabaseButton) {
//         exportDatabaseButton.addEventListener('click', function() {
//             window.importExport.exportModuleDatabase();
//         });
//     }
    
//     // Add event listener for import database button
//     const importDatabaseButton = document.getElementById('importDatabaseButton');
//     if (importDatabaseButton) {
//         importDatabaseButton.addEventListener('click', async function() {
//             const modules = await window.importExport.importModuleDatabase();
//             if (modules) {
//                 updateModuleDatabaseCount();
//                 updateModuleDatabaseTable();
//                 alert('Moduldatenbank erfolgreich importiert!');
//             }
//         });
//     }
// };

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

/**
 * Befüllt ein Select-Element mit den Bereichen aus der `areas`-Liste.
 * @param {HTMLSelectElement} selectElement Das zu befüllende Select-Element.
 * @param {boolean} includeEmptyOption Ob eine leere "Bitte wählen"-Option eingefügt werden soll.
 * @param {string|null} excludeAreaId Eine Area-ID, die nicht als Option angezeigt werden soll (nützlich für Parent-Select).
 * @param {string|null} preselectId Eine Area-ID, die vorausgewählt werden soll.
 */
function populateAreaSelect(selectElement, includeEmptyOption = true, excludeAreaId = null, preselectId = null) {
    selectElement.innerHTML = ''; // Bestehende Optionen löschen
    if (includeEmptyOption) {
        selectElement.innerHTML = '<option value="">Bitte wählen...</option>';
    }

    // Rekursive Funktion zum Hinzufügen der Optionen mit Einrückung
    function addOptionsRecursive(parentId = null, level = 0) {
        const children = areas.filter(area => area.parentId === parentId);
        children.sort((a, b) => a.name.localeCompare(b.name)); // Sortieren nach Namen

        children.forEach(area => {
            // Überspringe die ausgeschlossene ID (z.B. beim Bearbeiten eines Bereichs dessen eigene ID im Parent-Select)
            if (area.id === excludeAreaId) return;

            const option = document.createElement('option');
            option.value = area.id;
            // Zeige LP nur an, wenn > 0 oder Hauptbereich
            const lpText = (area.creditPoints > 0 || !area.parentId) ? ` (${area.creditPoints} LP)` : '';
            // Einrückung für Hierarchie
            option.textContent = '  '.repeat(level) + area.name + lpText;
            // Vorauswahl
            if (area.id === preselectId) {
                 option.selected = true;
            }
            selectElement.appendChild(option);

            // Rekursiver Aufruf für Unterbereiche
            addOptionsRecursive(area.id, level + 1);
        });
    }

    addOptionsRecursive(null, 0); // Starte mit den Top-Level-Bereichen
}


// Event delegation handler for module database table
function handleModuleDatabaseTableClick(event) {
    const button = event.target.closest('button[data-id]');
    if (!button) return;

    const moduleId = button.getAttribute('data-id');
    if (!moduleId) return;

    const moduleDatabase = window.moduleDatabase.loadModuleDatabase();
    const moduleData = moduleDatabase.find(m => m.id === moduleId);

    if (!moduleData) return;

    if (button.classList.contains('add-to-plan-btn')) {
        // **NEU: Rufe das Modal zur Bereichs-/Semesterauswahl auf**
        promptAreaAndSemesterForDbModule(moduleData);

        // **ALT (wird nicht mehr direkt genutzt für diesen Button):**
        // fillModuleFormWithData(moduleData);
        // document.getElementById('moduleTitleInput').scrollIntoView({ behavior: 'smooth' });
    }
    else if (button.classList.contains('edit-db-module-btn')) {
        // Bearbeiten in DB (unverändert)
        openModuleEditModal(moduleData, true);
    }
    else if (button.classList.contains('remove-db-module-btn')) {
        // Löschen aus DB (unverändert)
        if (confirm('Sind Sie sicher, dass Sie dieses Modul aus der Datenbank löschen möchten?')) {
            if (window.moduleDatabase.removeModuleFromDatabase(moduleId)) {
                updateModuleDatabaseCount();
                updateModuleDatabaseTable();
                // Optional: Alert entfernen oder anpassen
                // alert('Modul erfolgreich aus der Datenbank entfernt.');
            }
        }
    }
}


/**
 * Öffnet das Modal, um Bereich und Semester für ein DB-Modul auszuwählen.
 * @param {object} moduleData Die Daten des Moduls aus der Datenbank.
 */
function promptAreaAndSemesterForDbModule(moduleData) {
    const modal = document.getElementById('dbModuleAddModal');
    const form = document.getElementById('dbModuleAddForm');
    const areaSelect = document.getElementById('dbModuleAreaSelect');
    const semesterInput = document.getElementById('dbModuleSemesterInput');
    const moduleNameSpan = document.getElementById('dbModalModuleName');
    const moduleLPSpan = document.getElementById('dbModalModuleLP');
    const moduleDataInput = document.getElementById('dbModalModuleData'); // Hidden input

    // Modal-Inhalt füllen
    moduleNameSpan.textContent = moduleData.title;
    moduleLPSpan.textContent = moduleData.creditPoints;
    moduleDataInput.value = JSON.stringify(moduleData); // Moduldaten für später speichern

    // Bereichs-Dropdown füllen
    populateAreaSelect(areaSelect, true); // true -> "Bitte wählen" Option

    // Semester zurücksetzen
    semesterInput.value = '1';

    // Fehler-Nachrichten zurücksetzen
    document.getElementById('dbModalAreaError').classList.add('hidden');
    document.getElementById('dbModalSemesterError').classList.add('hidden');

    // Event Listener für das Formular (überschreibt ggf. alte Listener)
    form.onsubmit = handleDbModuleAddConfirm;

    // Listener für Schließen/Abbrechen
    document.getElementById('closeDbAddModalBtn').onclick = closeDbModuleAddModal;
    document.getElementById('cancelDbAddBtn').onclick = closeDbModuleAddModal;

    // Modal anzeigen
    modal.classList.remove('hidden');
    areaSelect.focus(); // Fokus auf das erste wichtige Feld
}

/**
 * Verarbeitet die Bestätigung im DB-Modul-Hinzufügen-Modal.
 * @param {Event} event Das Submit-Event des Formulars.
 */
function handleDbModuleAddConfirm(event) {
    event.preventDefault(); // Standard-Formular-Submit verhindern

    const areaSelect = document.getElementById('dbModuleAreaSelect');
    const semesterInput = document.getElementById('dbModuleSemesterInput');
    const areaError = document.getElementById('dbModalAreaError');
    const semesterError = document.getElementById('dbModalSemesterError');
    const moduleDataInput = document.getElementById('dbModalModuleData');

    const areaId = areaSelect.value;
    const semester = parseInt(semesterInput.value);
    const moduleData = JSON.parse(moduleDataInput.value);

    let isValid = true;
    areaError.classList.add('hidden');
    semesterError.classList.add('hidden');

    // Validierung
    if (!areaId) {
        areaError.classList.remove('hidden');
        isValid = false;
    }
    if (!semester || semester < 1) {
        semesterError.classList.remove('hidden');
        isValid = false;
    }

    if (!isValid) {
        return; // Abbruch, wenn Validierung fehlschlägt
    }

    // Neues Modul-Objekt für die `courses`-Liste erstellen
    const newCourseInstance = {
        // Eindeutige ID für diese *Instanz* im Plan
        id: 'module_plan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: moduleData.title,
        creditPoints: moduleData.creditPoints,
        areaId: areaId,       // Aus dem Modal ausgewählt
        semester: semester,   // Aus dem Modal ausgewählt
        // Übernehme relevante Felder aus der DB-Definition
        examType: moduleData.examType || 'schriftlich',
        language: moduleData.language || 'de',
        semester_offered: moduleData.semester_offered || 'Beides',
        link: moduleData.link || '',
        description: moduleData.description || '', // Beschreibung kann nützlich sein
        type: moduleData.type && moduleData.type.length > 0 ? moduleData.type : ['VL'], // Default-Typ ggf.
        // Verantwortlicher/Fachgebiet werden *nicht* automatisch übernommen,
        // da sie zur DB-Definition gehören, nicht zur Plan-Instanz.
        // Könnten optional hinzugefügt werden, falls gewünscht.
        responsible: '',
        department: ''
    };

    // Zur Kursliste hinzufügen
    courses.push(newCourseInstance);

    // Speichern und UI aktualisieren
    saveToLocalStorage();
    renderAreas(); // Rendert Bereiche und Semester neu

    // Modal schließen
    closeDbModuleAddModal();
}

/**
 * Schließt das Modal zum Hinzufügen von DB-Modulen.
 */
function closeDbModuleAddModal() {
    const modal = document.getElementById('dbModuleAddModal');
    if (modal) {
        modal.classList.add('hidden');
        // Optional: Formular zurücksetzen, falls nötig
        document.getElementById('dbModuleAddForm').reset();
        document.getElementById('dbModalModuleData').value = ''; // Wichtig: gespeicherte Daten löschen
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