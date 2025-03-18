let areas = [];
let courses = [];

document.getElementById('addAreaForm').addEventListener('submit', function(event) {
    event.preventDefault();
    addArea();
});

document.getElementById('addModuleForm').addEventListener('submit', function(event) {
    event.preventDefault();
    addModule();
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
            editButton.onclick = () => editArea(area.id);
            buttonContainer.appendChild(editButton);

            // Löschen Button mit Lucide Icon
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
            deleteButton.onclick = () => removeArea(area.id);
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
                moduleEditButton.onclick = () => editModule(module.id);
                moduleButtonContainer.appendChild(moduleEditButton);

                // Löschen Button mit Lucide Icon
                const moduleDeleteButton = document.createElement('button');
                moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
                moduleDeleteButton.onclick = () => removeModule(module.id);
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
            moduleEditButton.onclick = () => editModule(module.id);
            moduleButtonContainer.appendChild(moduleEditButton);

            const moduleDeleteButton = document.createElement('button');
            moduleDeleteButton.innerHTML = '<i data-lucide="trash" class="size-4"></i>';
            moduleDeleteButton.onclick = () => removeModule(module.id);
            moduleButtonContainer.appendChild(moduleDeleteButton);

            moduleDiv.appendChild(moduleButtonContainer);
            semesterDiv.appendChild(moduleDiv);
        });

        semesterContainer.appendChild(semesterDiv);
    }
}

// Bereich hinzufügen
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
        // Generiere unique ID
        const areaId = 'area_' + Date.now();
        
        areas.push({ 
            id: areaId,
            name: newAreaName,
            creditPoints: creditPoints,
            parentId: parentId
        });
        
        areaInput.value = '';
        lpInput.value = '6'; // Reset to default value
        parentSelect.value = '';
        
        saveToLocalStorage();
        renderAreas();
    }
}

// Bereich bearbeiten
function editArea(areaId) {
    const areaIndex = areas.findIndex(area => area.id === areaId);
    if (areaIndex === -1) return;
    
    const area = areas[areaIndex];
    
    const newAreaName = prompt("Neuer Bereich:", area.name);
    if (!newAreaName) return;
    
    const newLP = parseInt(prompt("Neue LP-Anzahl:", area.creditPoints));
    if (isNaN(newLP) || newLP <= 0) return;
    
    const possibleParents = areas.filter(a => a.id !== area.id);
    let parentOptions = "Mögliche Elternbereiche:\n";
    parentOptions += "0: Kein Elternbereich\n";
    possibleParents.forEach((p, i) => {
        parentOptions += `${i+1}: ${p.name}\n`;
    });
    
    const parentChoice = prompt(`${parentOptions}\nElternbereich auswählen (Nummer):`);
    let newParentId = null;
    
    if (parentChoice !== null && parentChoice !== "0") {
        const choiceIndex = parseInt(parentChoice) - 1;
        if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < possibleParents.length) {
            // Prüfe auf zirkuläre Abhängigkeit
            let currentParent = possibleParents[choiceIndex].id;
            let hasCircular = false;
            
            while (currentParent) {
                if (currentParent === area.id) {
                    hasCircular = true;
                    break;
                }
                const parentArea = areas.find(a => a.id === currentParent);
                currentParent = parentArea ? parentArea.parentId : null;
            }
            
            if (hasCircular) {
                alert("Zirkuläre Abhängigkeit erkannt! Bitte wählen Sie einen anderen Elternbereich.");
                return;
            }
            
            newParentId = possibleParents[choiceIndex].id;
        }
    }
    
    areas[areaIndex] = {
        ...area,
        name: newAreaName,
        creditPoints: newLP,
        parentId: newParentId
    };
    
    saveToLocalStorage();
    renderAreas();
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
        const finalTypes = selectedTypes.length > 0 ? selectedTypes : ['VL'];
        
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

// Modul entfernen
function removeModule(moduleId) {
    courses = courses.filter(module => module.id !== moduleId);
    saveToLocalStorage();
    renderAreas();
}

// Modul bearbeiten
function editModule(moduleId) {
    const moduleIndex = courses.findIndex(module => module.id === moduleId);
    if (moduleIndex === -1) return;
    
    const module = courses[moduleIndex];
    
    // Einfaches Bearbeiten-Modal anzeigen (sollte eigentlich durch ein besseres UI ersetzt werden)
    const newTitle = prompt('Titel:', module.title);
    if (!newTitle) return;
    
    const newCreditPoints = parseInt(prompt('LP:', module.creditPoints));
    if (isNaN(newCreditPoints) || newCreditPoints <= 0) return;
    
    const newSemester = parseInt(prompt('Semester:', module.semester));
    if (isNaN(newSemester) || newSemester <= 0) return;
    
    const areaOptions = areas.map((area, i) => `${i}: ${area.name}`).join('\n');
    const areaChoice = prompt(`Bereich auswählen (Nummer):\n${areaOptions}`);
    let newAreaId = null;
    
    if (areaChoice !== null) {
        const choiceIndex = parseInt(areaChoice);
        if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < areas.length) {
            newAreaId = areas[choiceIndex].id;
        }
    }
    
    const newDescription = prompt('Beschreibung:', module.description || '');
    const newLink = prompt('Link:', module.link || '');
    const newResponsible = prompt('Verantwortlicher:', module.responsible || '');
    const newExamType = prompt('Prüfungsform:', module.examType || '');
    const newLanguage = prompt('Sprache (de/en):', module.language || '');
    const newDepartment = prompt('Fachgebiet:', module.department || '');
    const newSemesterOffered = prompt('Turnus (SoSe/WiSe/Beides/k.A.):', module.semester_offered || '');
    
    const typeOptions = ['IV', 'VL', 'TUT', 'UE'];
    const typePrompt = typeOptions.map(type => 
        `${type} (${module.type && module.type.includes(type) ? 'Ja' : 'Nein'})`
    ).join('\n');
    
    const typeResponse = prompt(`Modultyp (kommagetrennt):\n${typePrompt}`);
    let newTypes = module.type || [];
    
    if (typeResponse) {
        newTypes = typeResponse.split(',').map(t => t.trim()).filter(t => typeOptions.includes(t));
    }
    
    courses[moduleIndex] = {
        ...module,
        title: newTitle,
        creditPoints: newCreditPoints,
        semester: newSemester,
        areaId: newAreaId,
        description: newDescription || '',
        link: newLink || '',
        responsible: newResponsible || '',
        examType: newExamType || '',
        language: newLanguage || '',
        department: newDepartment || '',
        semester_offered: newSemesterOffered || '',
        type: newTypes
    };
    
    saveToLocalStorage();
    renderAreas();
}

// Speichern in Local Storage
function saveToLocalStorage() {
    localStorage.setItem('areas', JSON.stringify(areas));
    localStorage.setItem('modules', JSON.stringify(courses));
}

// Laden aus Local Storage
function loadFromLocalStorage() {
    const storedAreas = localStorage.getItem('areas');
    const storedModules = localStorage.getItem('modules');

    if (storedAreas) {
        areas.push(...JSON.parse(storedAreas));
    }
    
    if (storedModules) {
        courses.push(...JSON.parse(storedModules));
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
    const data = await window.importExport.importStudyPlan();
    
    if (!data) return; // User cancelled or error
    
    if (confirm('Soll der aktuelle Studienplan überschrieben werden? Dies kann nicht rückgängig gemacht werden.')) {
        // Clear existing data
        areas = data.areas || [];
        courses = data.modules || [];
        
        // Save to localStorage
        saveToLocalStorage();
        
        // Re-render everything
        renderAreas();
        
        alert('Studienplan erfolgreich importiert!');
    }
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
                    <button class="add-to-plan-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs" data-title="${module.title}">
                        <i class="fas fa-plus mr-1"></i>Zum Plan
                    </button>
                    <button class="edit-db-module-btn text-blue-500 hover:text-blue-700" data-id="${module.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="remove-db-module-btn text-red-500 hover:text-red-700" data-id="${module.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Add event listeners
    document.querySelectorAll('.add-to-plan-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const moduleTitle = this.getAttribute('data-title');
            const moduleData = moduleDatabase.find(m => m.title === moduleTitle);
            
            if (moduleData) {
                document.getElementById('moduleTitleInput').value = moduleData.title;
                document.getElementById('moduleCreditPointsInput').value = moduleData.creditPoints;
                
                // Fill other fields
                fillModuleFormWithData(moduleData);
                
                // Scroll to module form
                document.getElementById('moduleTitleInput').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    
    document.querySelectorAll('.remove-db-module-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-id');
            
            if (confirm('Sind Sie sicher, dass Sie dieses Modul aus der Datenbank löschen möchten?')) {
                if (window.moduleDatabase.removeModuleFromDatabase(moduleId)) {
                    updateModuleDatabaseCount();
                    updateModuleDatabaseTable();
                    alert('Modul erfolgreich aus der Datenbank entfernt.');
                }
            }
        });
    });
    
    // Add event listener for edit button
    document.querySelectorAll('.edit-db-module-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const moduleId = this.getAttribute('data-id');
            const moduleData = moduleDatabase.find(m => m.id === moduleId);
            
            if (moduleData) {
                openModuleEditModal(moduleData);
            }
        });
    });
}

// Add a function to edit modules directly from the database
function openModuleEditModal(module) {
    // Create modal if it doesn't exist
    let modalContainer = document.getElementById('moduleEditModal');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'moduleEditModal';
        modalContainer.className = 'fixed inset-0 bg-gray-800 bg-opacity-50 hidden flex items-center justify-center z-50';
        
        modalContainer.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-semibold">Modul bearbeiten</h3>
                    <button id="closeDbModalBtn" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="editDbModuleForm" class="space-y-4">
                    <input type="hidden" id="editDbModuleId">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="editDbModuleTitle" class="block text-sm font-medium text-gray-700">Titel*</label>
                            <input type="text" id="editDbModuleTitle" class="border p-2 w-full rounded" required>
                        </div>
                        <div>
                            <label for="editDbModuleLP" class="block text-sm font-medium text-gray-700">Leistungspunkte*</label>
                            <input type="number" id="editDbModuleLP" min="1" class="border p-2 w-full rounded" required>
                        </div>
                    </div>
                    <div>
                        <label for="editDbModuleArea" class="block text-sm font-medium text-gray-700">Bereich</label>
                        <input type="text" id="editDbModuleArea" class="border p-2 w-full rounded" placeholder="Bereich zuordnen">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="editDbModuleExamType" class="block text-sm font-medium text-gray-700">Prüfungsform</label>
                            <select id="editDbModuleExamType" class="border p-2 w-full rounded">
                                <option value="schriftlich">Schriftlich</option>
                                <option value="mündlich">Mündlich</option>
                                <option value="Projekt">Projekt</option>
                                <option value="Portfolio">Portfolio</option>
                            </select>
                        </div>
                        <div>
                            <label for="editDbModuleTurnus" class="block text-sm font-medium text-gray-700">Turnus</label>
                            <select id="editDbModuleTurnus" class="border p-2 w-full rounded">
                                <option value="SoSe">Sommersemester</option>
                                <option value="WiSe">Wintersemester</option>
                                <option value="Beides">Beides</option>
                                <option value="">Keine Angabe</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label for="editDbModuleLink" class="block text-sm font-medium text-gray-700">Link</label>
                        <input type="url" id="editDbModuleLink" placeholder="https://..." class="border p-2 w-full rounded">
                    </div>
                    <div class="flex justify-end gap-2">
                        <button type="button" id="cancelDbEditBtn" class="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded">Abbrechen</button>
                        <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">Speichern</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modalContainer);
        
        // Add event listeners for the new modal
        document.getElementById('closeDbModalBtn').addEventListener('click', closeDbModuleEditModal);
        document.getElementById('cancelDbEditBtn').addEventListener('click', closeDbModuleEditModal);
        document.getElementById('editDbModuleForm').addEventListener('submit', saveDbModuleChanges);
    }
    
    // Fill modal with module data
    document.getElementById('editDbModuleId').value = module.id;
    document.getElementById('editDbModuleTitle').value = module.title;
    document.getElementById('editDbModuleLP').value = module.creditPoints;
    document.getElementById('editDbModuleArea').value = module.areaName || '';
    document.getElementById('editDbModuleExamType').value = module.examType || 'schriftlich';
    document.getElementById('editDbModuleTurnus').value = module.semester_offered || '';
    document.getElementById('editDbModuleLink').value = module.link || '';
    
    // Show modal
    modalContainer.classList.remove('hidden');
}

function closeDbModuleEditModal() {
    const modal = document.getElementById('moduleEditModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function saveDbModuleChanges(e) {
    e.preventDefault();
    
    const moduleId = document.getElementById('editDbModuleId').value;
    const updatedData = {
        title: document.getElementById('editDbModuleTitle').value.trim(),
        creditPoints: parseInt(document.getElementById('editDbModuleLP').value),
        areaName: document.getElementById('editDbModuleArea').value.trim(),
        examType: document.getElementById('editDbModuleExamType').value,
        semester_offered: document.getElementById('editDbModuleTurnus').value,
        link: document.getElementById('editDbModuleLink').value.trim()
    };
    
    if (updatedData.title && updatedData.creditPoints > 0) {
        if (window.moduleDatabase.updateModuleInDatabase(moduleId, updatedData)) {
            closeDbModuleEditModal();
            updateModuleDatabaseTable();
            updateModuleDatabaseCount();
            alert('Modul erfolgreich aktualisiert.');
        } else {
            alert('Fehler beim Aktualisieren des Moduls.');
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
