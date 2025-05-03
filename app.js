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
    // Konstante Farben für Konsistenz
     const semesterColors = [
        'border-red-400', 'border-blue-400', 'border-green-400', 'border-yellow-400',
        'border-purple-400', 'border-pink-400', 'border-indigo-400', 'border-teal-400',
        'border-orange-400', 'border-cyan-400'
    ];
     // Nimmt den Semesterwert (als Zahl) und wählt eine Farbe aus der Liste
     const semesterIndex = parseInt(semester);
     if (!isNaN(semesterIndex) && semesterIndex > 0) {
         return semesterColors[(semesterIndex - 1) % semesterColors.length];
     }
     return 'border-gray-400'; // Fallback
}

// Bereiche rendern
function renderAreas() {
    const areasContainer = document.getElementById('areasContainer');
    const moduleAreaSelect = document.getElementById('moduleAreaSelect');
    const parentAreaSelect = document.getElementById('parentAreaSelect');
    const semesterContainer = document.getElementById('semesterContainer'); // Nötig für updateSemesterView

    areasContainer.innerHTML = '';
    moduleAreaSelect.innerHTML = '<option value="">Bereich auswählen</option>';
    parentAreaSelect.innerHTML = '<option value="">Kein Übergeordneter Bereich</option>';

    // Funktion zum rekursiven Rendern der Bereiche
    function renderAreaHierarchy(parentId = null, level = 0) {
        const filteredAreas = areas.filter(area => area.parentId === parentId);

        filteredAreas.sort((a, b) => a.name.localeCompare(b.name)); // Optional: Sortieren

        filteredAreas.forEach((area) => {
            // Bereich zum Select hinzufügen
            const option = document.createElement('option');
            option.value = area.id;
            // Zeige 0 LP nicht an, wenn es 0 ist und ein Unterbereich ist
            const lpText = (area.parentId && area.creditPoints === 0) ? '' : ` (${area.creditPoints} LP)`;
            option.textContent = '  '.repeat(level) + area.name + lpText;
            moduleAreaSelect.appendChild(option);

            // Bereich zum Parent-Select hinzufügen
            const parentOption = document.createElement('option');
            parentOption.value = area.id;
            parentOption.textContent = '  '.repeat(level) + area.name + lpText;
            parentAreaSelect.appendChild(parentOption);

            const areaDiv = document.createElement('div');
            areaDiv.className = 'bg-white rounded-md shadow px-2 py-4 mb-4 flex flex-col justify-between gap-2 border-l-4'; // Border hinzugefügt
             // Style für Einrückung und Randfarbe basierend auf Level
            areaDiv.style.marginLeft = `${level * 25}px`; // Etwas mehr Einrückung
            const borderColors = ['border-blue-200', 'border-green-200', 'border-yellow-200', 'border-purple-200', 'border-pink-200'];
            areaDiv.classList.add(borderColors[level % borderColors.length]);


            const areaHeader = document.createElement('div');
            areaHeader.className = 'flex justify-between items-center w-full px-2';

            const areaTitle = document.createElement('h2');
            // Zeige LP nur an, wenn sie > 0 sind oder es ein Hauptbereich ist
            const titleLPText = (area.creditPoints > 0 || !area.parentId) ? ` (${area.creditPoints} LP)` : '';
            areaTitle.innerText = `${area.name}${titleLPText}`;
            areaTitle.className = 'text-lg font-bold';
            areaHeader.appendChild(areaTitle);

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'flex gap-2 ml-auto items-center pl-4'; // ml-auto für Rechtsbündigkeit

            const editButton = document.createElement('button');
            editButton.innerHTML = '<i data-lucide="edit" class="size-4"></i>';
            editButton.classList.add('area-edit-btn', 'text-blue-600', 'hover:text-blue-800');
            editButton.setAttribute('data-id', area.id);
            buttonContainer.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
            deleteButton.classList.add('area-delete-btn', 'text-red-600', 'hover:text-red-800');
            deleteButton.setAttribute('data-id', area.id);
            buttonContainer.appendChild(deleteButton);

            areaHeader.appendChild(buttonContainer);
            areaDiv.appendChild(areaHeader);

            // --- NEU: LP-Verbrauch anzeigen (rekursiv) ---
            const usageLP = calculateAreaUsageLP(area.id);
            const lpUsageDiv = document.createElement('div');
            lpUsageDiv.className = 'text-sm px-2 mt-1'; // mt-1 hinzugefügt

            // Zeige Kapazität nur an, wenn sie > 0 ist oder es ein Hauptbereich ist
            if (area.creditPoints > 0 || !area.parentId) {
                 lpUsageDiv.innerHTML = `<span>Verwendet: ${usageLP} von ${area.creditPoints} LP</span>`;
                 if (usageLP > area.creditPoints) {
                     lpUsageDiv.classList.add('text-red-500', 'font-bold');
                 } else if (usageLP === area.creditPoints) {
                     lpUsageDiv.classList.add('text-green-600');
                 }
            } else {
                 // Für Unterbereiche mit 0 LP nur die verwendeten anzeigen
                 lpUsageDiv.innerHTML = `<span>Verwendet: ${usageLP} LP</span>`;
            }
            areaDiv.appendChild(lpUsageDiv);
            // --- ENDE NEU ---


            const moduleList = document.createElement('div');
            moduleList.className = 'mt-2 px-2'; // Abstand hinzugefügt

            const areaModules = courses.filter(module => module.areaId === area.id);
             areaModules.sort((a,b) => a.semester - b.semester || a.title.localeCompare(b.title)); // Sortieren

            areaModules.forEach((module) => {
                 const moduleDiv = document.createElement('div');
                moduleDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded mb-1';

                const moduleInfo = document.createElement('div');
                moduleInfo.className = 'flex flex-col text-sm'; // text-sm für kompaktere Darstellung

                const moduleTitle = document.createElement('span');
                moduleTitle.className = 'font-medium';
                moduleTitle.innerText = `${module.title} (${module.creditPoints} LP, Sem: ${module.semester})`; // Sem: Abkürzung
                moduleInfo.appendChild(moduleTitle);

                // Details kompakter darstellen
                const moduleDetails = document.createElement('span');
                moduleDetails.className = 'text-xs text-gray-600'; // text-xs
                const typeString = module.type && module.type.length > 0 ? module.type.join('/') : 'k.A.'; // '/' als Separator
                moduleDetails.innerText = `${typeString} | ${module.examType} | ${module.language} | ${module.semester_offered}`;
                moduleInfo.appendChild(moduleDetails);

                moduleDiv.appendChild(moduleInfo);

                const moduleButtonContainer = document.createElement('div');
                 moduleButtonContainer.className = 'flex gap-2 ml-auto items-center pl-2'; // ml-auto, pl-2

                const moduleEditButton = document.createElement('button');
                moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-4"></i>';
                moduleEditButton.classList.add('module-edit-btn', 'text-blue-600', 'hover:text-blue-800'); // Farben hinzugefügt
                moduleEditButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleEditButton);

                const moduleDeleteButton = document.createElement('button');
                moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
                moduleDeleteButton.classList.add('module-delete-btn', 'text-red-600', 'hover:text-red-800'); // Farben hinzugefügt
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

    // Semestercontainer aktualisieren (enthält jetzt Gesamt-LP-Berechnung)
    updateSemesterView();

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

    // Module nach Semestern sortieren
    const sortedModules = courses.slice().sort((a, b) => a.semester - b.semester || a.title.localeCompare(b.title));

    // Module nach Semestern gruppieren
    const modulesBySemester = sortedModules.reduce((acc, module) => {
        if (!acc[module.semester]) {
            acc[module.semester] = [];
        }
        acc[module.semester].push(module);
        return acc;
    }, {});

    let totalStudyPlanLPs = 0; // Variable für Gesamt-LP

    // Semester rendern und Gesamt-LP berechnen
    Object.entries(modulesBySemester)
        .sort(([semA], [semB]) => parseInt(semA) - parseInt(semB)) // Nach Semesternummer sortieren
        .forEach(([semester, modules]) => {
            const semesterDiv = document.createElement('div');
            // semesterDiv.className = `p-2 rounded-md shadow mb-4 ${generateColor(semester)}/30`; // Alte Farbe
             semesterDiv.className = `p-3 rounded-lg shadow mb-4 border-l-4 ${generateColor(semester)}`; // Neue Optik mit Rand


            const totalLP = modules.reduce((sum, module) => sum + module.creditPoints, 0);
            totalStudyPlanLPs += totalLP; // Zur Gesamtsumme addieren

            const semesterHeader = document.createElement('div');
            semesterHeader.className = 'flex justify-between items-center mb-2';

            const semesterTitle = document.createElement('h3');
            semesterTitle.innerText = `Semester ${semester}`;
            semesterTitle.className = 'text-xl font-bold';
            semesterHeader.appendChild(semesterTitle);

            const lpCounter = document.createElement('span');
            lpCounter.className = 'py-1 px-3 rounded-full text-sm font-bold'; // Basis-Styling
            lpCounter.innerText = `${totalLP} LP`;

            // Highlight basierend auf LP-Bereich
            if (totalLP < 25) {
                lpCounter.classList.add('bg-yellow-200', 'text-yellow-800');
            } else if (totalLP > 33) {
                lpCounter.classList.add('bg-red-200', 'text-red-800');
            } else {
                lpCounter.classList.add('bg-green-200', 'text-green-800');
            }

            semesterHeader.appendChild(lpCounter);
            semesterDiv.appendChild(semesterHeader);

            modules.forEach((module) => {
                 const moduleDiv = document.createElement('div');
                moduleDiv.className = 'flex justify-between items-center bg-white p-2 rounded mb-1 shadow-sm'; // Weißer Hintergrund, leichter Schatten

                const moduleArea = areas.find(area => area.id === module.areaId);
                const areaName = moduleArea ? moduleArea.name : "Kein Bereich";

                const moduleInfo = document.createElement('div');
                moduleInfo.className = 'flex flex-col'; // Kompakter

                const moduleTitle = document.createElement('span');
                moduleTitle.className = 'font-medium';
                moduleTitle.innerText = `${module.title} (${module.creditPoints} LP)`;
                moduleInfo.appendChild(moduleTitle);

                const moduleDetails = document.createElement('span');
                moduleDetails.className = 'text-xs text-gray-600';
                 const typeString = module.type && module.type.length > 0 ? module.type.join('/') : 'k.A.';
                moduleDetails.innerText = `Bereich: ${areaName} | ${typeString} | ${module.examType}`;
                moduleInfo.appendChild(moduleDetails);

                moduleDiv.appendChild(moduleInfo);

                const moduleButtonContainer = document.createElement('div');
                moduleButtonContainer.className = 'flex gap-2 ml-auto items-center pl-2'; // ml-auto

                const moduleEditButton = document.createElement('button');
                moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-4"></i>';
                moduleEditButton.classList.add('module-edit-btn', 'text-blue-600', 'hover:text-blue-800');
                moduleEditButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleEditButton);

                const moduleDeleteButton = document.createElement('button');
                moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
                moduleDeleteButton.classList.add('module-delete-btn', 'text-red-600', 'hover:text-red-800');
                moduleDeleteButton.setAttribute('data-id', module.id);
                moduleButtonContainer.appendChild(moduleDeleteButton);

                moduleDiv.appendChild(moduleButtonContainer);
                semesterDiv.appendChild(moduleDiv);
            });

            semesterContainer.appendChild(semesterDiv);
    });


    // Gesamt-LP im Titel anzeigen
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

    // Hide any previous error messages
    const areaInputError = document.getElementById('areaInputError');
    const areaCreditPointsError = document.getElementById('areaCreditPointsError');
    areaInputError.classList.add('hidden');
    areaCreditPointsError.classList.add('hidden');

    const newAreaName = areaInput.value.trim();
    // Erlaube 0 LP für Unterbereiche, standardisiere auf 0, wenn leer oder negativ UND es ein Unterbereich ist
    const parentId = parentSelect.value || null;
    let creditPoints = parseInt(lpInput.value);

    // Wenn es ein Unterbereich ist und die Eingabe ungültig/leer/<0 ist, setze auf 0. Sonst parse normal.
    if (parentId && (isNaN(creditPoints) || creditPoints < 0)) {
        creditPoints = 0;
    } else if (isNaN(creditPoints)) {
        // Für Hauptbereiche setze auf einen Standardwert oder 0, Validierung prüft später
        creditPoints = 0; // Wird später von Validierung abgefangen, wenn parentId null ist
    }


    let isValid = true;

    // Validate area name
    if (!newAreaName) {
        areaInputError.textContent = 'Bitte geben Sie einen Bereichsnamen ein.'; // Standardnachricht
        areaInputError.classList.remove('hidden');
        isValid = false;
    }

    // Validate credit points: Hauptbereiche (>0), Unterbereiche (>=0)
    if (!parentId && creditPoints <= 0) {
        areaCreditPointsError.textContent = 'Hauptbereiche müssen eine positive LP-Anzahl (> 0) haben.'; // Angepasste Nachricht
        areaCreditPointsError.classList.remove('hidden');
        isValid = false;
    } else if (parentId && creditPoints < 0) {
        // Optional: Verhindern negativer LPs auch für Unterbereiche
        areaCreditPointsError.textContent = 'Leistungspunkte dürfen nicht negativ sein.';
        areaCreditPointsError.classList.remove('hidden');
        isValid = false;
    }


    if (isValid) {
        const cleanName = cleanAreaName(newAreaName).replace(/\s+/g, '_');
        const areaId = 'area_' + cleanName + '_' + Date.now(); // Eindeutiger machen

        const existingArea = areas.find(area =>
            cleanAreaName(area.name) === cleanAreaName(newAreaName) && area.parentId === parentId // Prüfe auch Parent für Eindeutigkeit auf gleicher Ebene
        );

        if (existingArea) {
             if (confirm(`Ein Bereich mit dem Namen "${existingArea.name}" existiert bereits auf dieser Ebene. Möchten Sie diesen bearbeiten?`)) {
                editArea(existingArea.id); // Statt editArea besser openAreaEditModal aufrufen
                // openAreaEditModal(existingArea); // Direkter Aufruf wäre besser
                return;
            } else {
                 return; // Abbrechen, wenn nicht bearbeitet werden soll
            }
        }

        areas.push({
            id: areaId,
            name: newAreaName, // Originalnamen speichern
            creditPoints: creditPoints,
            parentId: parentId
        });

        saveAreaToDatabase(newAreaName, creditPoints);

        areaInput.value = '';
        lpInput.value = '6'; // Reset to default value
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
    parentSelect.innerHTML = '<option value="">Kein Übergeordneter Bereich</option>'; // Reset

    // Mögliche Elternteile hinzufügen (ohne sich selbst und eigene Nachfahren)
    const possibleParents = areas.filter(a => {
        if (a.id === area.id) return false; // Nicht sich selbst
        // Prüfe auf zirkuläre Abhängigkeit
        let currentParentId = a.parentId;
        while (currentParentId) {
            if (currentParentId === area.id) return false; // Ist ein Nachfahre
            const parentArea = areas.find(pa => pa.id === currentParentId);
            currentParentId = parentArea ? parentArea.parentId : null;
        }
        return true; // Kein Konflikt gefunden
    });

    possibleParents.forEach(a => {
        const option = document.createElement('option');
        option.value = a.id;
        option.textContent = a.name; // TODO: Hierarchie andeuten?
        option.selected = a.id === area.parentId;
        parentSelect.appendChild(option);
    });

    const modal = document.getElementById('areaEditModal');
    modal.classList.remove('hidden');

    // Stelle sicher, dass der Submit-Handler nur einmal angehängt wird oder überschrieben wird
    document.getElementById('editAreaForm').onsubmit = function(e) {
        e.preventDefault();
        const areaId = document.getElementById('editAreaId').value; // Holen der ID aus dem Formular
        const currentAreaIndex = areas.findIndex(a => a.id === areaId); // Index erneut finden
         if (currentAreaIndex === -1) {
             console.error("Fehler: Bereich zum Bearbeiten nicht gefunden.");
             closeAreaEditModal();
             return;
         }

        const newName = document.getElementById('editAreaName').value.trim();
        const newLP = parseInt(document.getElementById('editAreaLP').value);
        const newParentId = document.getElementById('editAreaParent').value || null;
        const lpErrorField = document.getElementById('editAreaLPError'); // Fehlerfeld holen
        lpErrorField.classList.add('hidden'); // Fehler erstmal verstecken

        let saveIsValid = true;
        if (!newName) {
            alert('Bitte geben Sie einen Namen für den Bereich ein.');
            saveIsValid = false;
        }
        // Validierung: Hauptbereich (>0 LP), Unterbereich (>=0 LP)
        else if (!newParentId && (isNaN(newLP) || newLP <= 0)) {
            lpErrorField.textContent = 'Hauptbereiche müssen > 0 LP haben.';
            lpErrorField.classList.remove('hidden');
            // alert('Hauptbereiche (ohne übergeordneten Bereich) müssen eine positive Anzahl an Leistungspunkten (> 0) haben.');
            saveIsValid = false;
        } else if (newParentId && (isNaN(newLP) || newLP < 0)) {
            lpErrorField.textContent = 'LP dürfen nicht negativ sein.';
            lpErrorField.classList.remove('hidden');
            // alert('Leistungspunkte für Unterbereiche dürfen nicht negativ sein.');
            saveIsValid = false;
        }

        if (saveIsValid) {
            const finalLP = (newParentId && newLP < 0) ? 0 : newLP; // Stelle sicher, dass LP >= 0 ist, falls Validierung geändert wird

            // Update area im Array
            areas[currentAreaIndex] = {
                ...areas[currentAreaIndex], // Behalte alte Eigenschaften wie ID
                name: newName,
                creditPoints: finalLP,
                parentId: newParentId
            };

            // Update in der "Datenbank" (localStorage für Autocomplete etc.)
            saveAreaToDatabase(newName, finalLP); // Updated diese Funktion auch

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