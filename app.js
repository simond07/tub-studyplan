let areas = [];
let modules = [];

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
    const semesterContainer = document.getElementById('semesterContainer');
    
    areasContainer.innerHTML = ''; // Aktuellen Inhalt löschen
    moduleAreaSelect.innerHTML = '<option value="">Bereich auswählen</option>'; // Reset des Select

    areas.forEach((area, index) => {
        const areaDiv = document.createElement('div');
        areaDiv.className = 'bg-white rounded-md shadow px-2 py-4 mb-4 flex flex-col justify-between gap-2 ';
        
        const areaHeader = document.createElement('div');
        areaHeader.className = 'flex justify-between items-center w-full px-2';

        const areaTitle = document.createElement('h2');
        areaTitle.innerText = area.name;
        areaTitle.className = 'text-lg font-bold';
        areaHeader.appendChild(areaTitle);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex gap-2 ml-8 items-center';

        // Bearbeiten Button mit Lucide Icon
        const editButton = document.createElement('button');
        editButton.innerHTML = '<i data-lucide="edit" class="size-5"></i>';
        editButton.onclick = () => editArea(index);
        buttonContainer.appendChild(editButton);

        // Löschen Button mit Lucide Icon
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i data-lucide="trash" class="size-5"></i>';
        deleteButton.onclick = () => removeArea(index);
        buttonContainer.appendChild(deleteButton);

        areaHeader.appendChild(buttonContainer);

        areaDiv.appendChild(areaHeader);

        const moduleList = document.createElement('div');
        
        const areaModules = modules.filter(module => module.areas.includes(area.name));
        areaModules.forEach((module, index) => {
            const moduleDiv = document.createElement('div');
            moduleDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded mb-1';
            
            if (module.multipleAreas) {
                const badge = document.createElement('span');
                badge.className = 'bg-yellow-300 text-black text-xs font-bold px-1 rounded';
                badge.innerText = 'Mehrere Bereiche';
                moduleDiv.appendChild(badge);
            }

            moduleDiv.innerHTML += `<span>${module.title} (Semester: ${module.semester})</span>`;
            
            // Bearbeiten und Entfernen Buttons für Module mit Lucide Icons
            const modulebuttonContainer = document.createElement('div');
            modulebuttonContainer.className = 'flex gap-2 ml-8 items-center';

            // Bearbeiten Button mit Lucide Icon
            const moduleEditButton = document.createElement('button');
            moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-5"></i>';
            moduleEditButton.onclick = () => editModule(index);
            modulebuttonContainer.appendChild(moduleEditButton);

            // Löschen Button mit Lucide Icon
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i data-lucide="trash" class="size-5"></i>';
            deleteButton.onclick = () => removeModule(index);
            modulebuttonContainer.appendChild(deleteButton);


            moduleDiv.appendChild(modulebuttonContainer);

            moduleList.appendChild(moduleDiv);
        });

        areaDiv.appendChild(moduleList);
        areasContainer.appendChild(areaDiv);

        // Bereich im Select hinzufügen
        const option = document.createElement('option');
        option.value = area.name;
        option.textContent = area.name;
        moduleAreaSelect.appendChild(option);
    });

    // Semester Container leeren
    semesterContainer.innerHTML = '';

    // Module nach Semestern sortieren
    const sortedModules = modules.slice().sort((a, b) => a.semester - b.semester);

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

        modules.forEach((module, index) => {
            const moduleDiv = document.createElement('div');
            moduleDiv.className = 'flex justify-between items-center bg-gray-100 p-2 rounded mb-1';

            if (module.multipleAreas) {
                const badge = document.createElement('span');
                badge.className = 'bg-yellow-300 text-black text-xs font-bold px-1 rounded';
                badge.innerText = 'Mehrere Bereiche';
                moduleDiv.appendChild(badge);
            }

            moduleDiv.innerHTML += `<span>${module.title} (Bereiche: ${module.areas.join(', ')})</span>`;

            // Bearbeiten und Entfernen Buttons für Module mit Lucide Icons
            const modulebuttonContainer = document.createElement('div');
            modulebuttonContainer.className = 'flex gap-2 ml-8 items-center';

            // Bearbeiten Button mit Lucide Icon
            const moduleEditButton = document.createElement('button');
            moduleEditButton.innerHTML = '<i data-lucide="edit" class="size-5"></i>';
            moduleEditButton.onclick = () => editModule(index);
            modulebuttonContainer.appendChild(moduleEditButton);

            // Löschen Button mit Lucide Icon
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i data-lucide="trash" class="size-5"></i>';
            deleteButton.onclick = () => removeModule(index);
            modulebuttonContainer.appendChild(deleteButton);

            moduleDiv.appendChild(modulebuttonContainer);

            semesterDiv.appendChild(moduleDiv);
        });

        semesterContainer.appendChild(semesterDiv);
    }
}

// Bereich hinzufügen
function addArea() {
    const areaInput = document.getElementById('areaInput');
    const newAreaName = areaInput.value.trim();
    
    if (newAreaName && !areas.some(area => area.name === newAreaName)) {
        areas.push({ name: newAreaName });
        areaInput.value = '';
        saveToLocalStorage();
        renderAreas();
    }
}

// Bereich bearbeiten
function editArea(index) {
    const newAreaName = prompt("Neuer Bereich:", areas[index].name);
    
    if (newAreaName && !areas.some((area, i) => i !== index && area.name === newAreaName)) {
        areas[index].name = newAreaName;
        saveToLocalStorage();
        renderAreas();
    }
}

// Bereich entfernen
function removeArea(index) {
    areas.splice(index, 1);
    modules.forEach(module => {
        module.areas = module.areas.filter(area => area !== areas[index].name);
    });
    saveToLocalStorage();
    renderAreas();
}

// Modul hinzufügen
function addModule() {
    const titleInput = document.getElementById('moduleTitleInput');
    const areaSelect = document.getElementById('moduleAreaSelect');
    const semesterInput = document.getElementById('moduleSemesterInput');

    const title = titleInput.value.trim();
    const selectedArea = areaSelect.value;
    const semester = semesterInput.value.trim();

    if (title && selectedArea && semester) {
        modules.push({ title, areas: [selectedArea], semester, multipleAreas: false });
        
        titleInput.value = '';
        areaSelect.value = '';
        semesterInput.value = '';
        
        saveToLocalStorage();
        renderAreas();
    }
}

// Modul entfernen
function removeModule(index) {
    modules.splice(index, 1);
    saveToLocalStorage();
    renderAreas();
}

// Modul bearbeiten
function editModule(index) {
    const moduleToEdit = modules[index];
    
    const newTitle = prompt('Neuer Titel:', moduleToEdit.title);
    const newAreasString = prompt('Neue Bereiche (Komma getrennt):', moduleToEdit.areas.join(', '));
    const newSemester = prompt('Neues Semester:', moduleToEdit.semester);

    if (newTitle && newAreasString && newSemester) {
        modules[index] = { 
            title: newTitle,
            areas: newAreasString.split(',').map(area => area.trim()),
            semester: newSemester,
            multipleAreas: newAreasString.split(',').length > 1 
        };
        
        saveToLocalStorage();
        renderAreas();
    }
}

// Speichern in Local Storage
function saveToLocalStorage() {
    localStorage.setItem('areas', JSON.stringify(areas));
    localStorage.setItem('modules', JSON.stringify(modules));
}

// Laden aus Local Storage
function loadFromLocalStorage() {
    const storedAreas = localStorage.getItem('areas');
    const storedModules = localStorage.getItem('modules');

    if (storedAreas) {
        areas.push(...JSON.parse(storedAreas));
    }
    
    if (storedModules) {
        modules.push(...JSON.parse(storedModules));
    }
}

// Initiales Laden
window.onload = () => {
    loadFromLocalStorage();
    renderAreas(); // Initiales Rendern
    lucide.createIcons();
};
