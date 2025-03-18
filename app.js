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

        const semesterTitle = document.createElement('h3');
        semesterTitle.innerText = `Semester ${semester}`;
        semesterTitle.className = 'text-xl font-bold mb-2';
        semesterDiv.appendChild(semesterTitle);

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
    console.log("bereich hinzufügen");
    const areaInput = document.getElementById('areaInput');
    const lpInput = document.getElementById('areaCreditPointsInput');
    const parentSelect = document.getElementById('parentAreaSelect');
    
    const newAreaName = areaInput.value.trim();
    const creditPoints = parseInt(lpInput.value) || 0;
    const parentId = parentSelect.value || null;
    
    if (newAreaName && creditPoints > 0) {
        // Generiere unique ID
        const areaId = 'area_' + Date.now();
        
        areas.push({ 
            id: areaId,
            name: newAreaName,
            creditPoints: creditPoints,
            parentId: parentId
        });
        
        areaInput.value = '';
        lpInput.value = '';
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
    const areaId = areaSelect.value;
    const semester = parseInt(semesterInput.value);
    const creditPoints = parseInt(creditPointsInput.value) || 0;
    const description = descriptionInput.value.trim();
    const link = linkInput.value.trim();
    const responsible = responsibleInput.value.trim();
    const examType = examTypeInput.value.trim();
    const language = languageSelect.value;
    const department = departmentInput.value.trim();
    const semesterOffered = semesterOfferedSelect.value;

    if (title && areaId && semester > 0 && creditPoints > 0) {
        // Generiere unique ID
        const moduleId = 'module_' + Date.now();
        
        courses.push({ 
            id: moduleId,
            title, 
            areaId, 
            semester,
            creditPoints,
            description,
            link,
            responsible,
            examType,
            language,
            department,
            semester_offered: semesterOffered,
            type: selectedTypes
        });
        
        // Formular zurücksetzen
        document.getElementById('addModuleForm').reset();
        
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
    const newSemesterOffered = prompt('Turnus (SoSe/WiSe/Beides):', module.semester_offered || '');
    
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

// Initiales Laden
window.onload = () => {
    loadFromLocalStorage();
    renderAreas(); // Initiales Rendern
    lucide.createIcons();
};

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
