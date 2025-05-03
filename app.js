let areas = [];
let courses = [];
let responsiblePersons = [];
let departments = [];
let dbSortColumn = 'isFavorite'; // Standard: Favoriten oben
let dbSortDirection = 'desc'; // 'asc' oder 'desc' (desc für Favoriten oben)
let dbSearchTerm = '';
let dbSelectedArea = '';
let dbCurrentAdvancedFilter = null; // Das aktuell angewendete erweiterte Filterobjekt
let savedDbFilters = []; // Geladene Filter aus localStorage
let dbShowHidden = false;
let startSemester = { type: 'WiSe', year: 2024 };

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

    // Lade gespeicherte Filter
    savedDbFilters = window.moduleDatabase.loadDbFilters();
    populateSavedFiltersDropdown();

    // Event Listener für Filter/Suche/Sortierung
    const dbSearchInput = document.getElementById('dbSearchInput');
    const dbAreaFilterSelect = document.getElementById('dbAreaFilterSelect');
    const dbModuleTableHead = document.querySelector('#moduleDatabaseTable thead');
    const openFilterBuilderBtn = document.getElementById('openFilterBuilderBtn');
    const closeFilterBuilderBtn = document.getElementById('closeFilterBuilderBtn');
    const cancelFilterBuilderBtn = document.getElementById('cancelFilterBuilderBtn');
    const addFilterConditionBtn = document.getElementById('addFilterConditionBtn');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const saveAndApplyFilterBtn = document.getElementById('saveAndApplyFilterBtn');
    const savedFilterSelect = document.getElementById('dbSavedFilterSelect');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const saveCurrentFilterBtn = document.getElementById('saveCurrentFilterBtn'); // Button zum Speichern aktiver Filter
    const showHiddenCheckbox = document.getElementById('showHiddenDbModules');
    
    // Lade Startsemester und setze UI
    startSemester = getStartSemester();
    const startTypeSelect = document.getElementById('startSemesterType');
    const startYearInput = document.getElementById('startYearInput');
    if (startTypeSelect) startTypeSelect.value = startSemester.type;
    if (startYearInput) startYearInput.value = startSemester.year;
    // Event Listener für Startsemester Speichern
    const saveStartBtn = document.getElementById('saveStartSemesterBtn');
    if (saveStartBtn) saveStartBtn.addEventListener('click', saveStartSemester);
    // Lade gespeicherte Filter
    savedDbFilters = window.moduleDatabase.loadDbFilters();
    populateSavedFiltersDropdown();
    

    // Listener für JSON Export (existierend)
    const exportButton = document.getElementById('exportButton'); // Angenommen dieser Button existiert noch
    if (exportButton) exportButton.addEventListener('click', () => window.importExport.exportStudyPlan(areas, courses));


    // NEU: Listener für Word Exporte
    const exportWordAreaBtn = document.getElementById('exportWordAreaButton');
    if (exportWordAreaBtn) {
        exportWordAreaBtn.addEventListener('click', exportStudyPlanAsWordAreaList);
    } else {
        console.error("Button #exportWordAreaButton nicht gefunden");
    }

    const exportWordGridBtn = document.getElementById('exportWordGridButton');
    if (exportWordGridBtn) {
        exportWordGridBtn.addEventListener('click', exportStudyPlanAsWordGrid);
    } else {
        console.error("Button #exportWordGridButton nicht gefunden");
    }

    // Event Listener für Filter/Suche/Sortierung
    if (showHiddenCheckbox) showHiddenCheckbox.addEventListener('change', handleShowHiddenToggle);
    if (dbSearchInput) dbSearchInput.addEventListener('input', handleDbSearch);
    if (dbAreaFilterSelect) dbAreaFilterSelect.addEventListener('change', handleDbAreaFilter);
    if (dbModuleTableHead) dbModuleTableHead.addEventListener('click', handleDbSort);
    if (openFilterBuilderBtn) openFilterBuilderBtn.addEventListener('click', openFilterBuilder);
    if (closeFilterBuilderBtn) closeFilterBuilderBtn.addEventListener('click', closeFilterBuilder);
    if (cancelFilterBuilderBtn) cancelFilterBuilderBtn.addEventListener('click', closeFilterBuilder);
    if (addFilterConditionBtn) addFilterConditionBtn.addEventListener('click', addFilterConditionRow);
    if (applyFilterBtn) applyFilterBtn.addEventListener('click', applyAdvancedFilterFromBuilder);
    if (saveAndApplyFilterBtn) saveAndApplyFilterBtn.addEventListener('click', saveAndApplyAdvancedFilter);
    if (savedFilterSelect) savedFilterSelect.addEventListener('change', applySavedFilter);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllDbFilters);
    if (saveCurrentFilterBtn) saveCurrentFilterBtn.addEventListener('click', saveCurrentFilterSetup); // Listener für Speichern-Button

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

function handleShowHiddenToggle(event) {
    dbShowHidden = event.target.checked;
    updateModuleDatabaseTable(); // Tabelle neu rendern
}

function handleDbSearch(event) {
    dbSearchTerm = event.target.value.trim().toLowerCase();
    updateModuleDatabaseTable(); // Tabelle neu rendern mit Suchfilter
}

function handleDbAreaFilter(event) {
    dbSelectedArea = event.target.value;
    updateModuleDatabaseTable(); // Tabelle neu rendern mit Bereichsfilter
}

function handleDbSort(event) {
    const header = event.target.closest('th[data-sort-by]');
    if (!header) return;

    const newSortColumn = header.getAttribute('data-sort-by');

    if (newSortColumn === dbSortColumn) {
        // Richtung umkehren
        dbSortDirection = dbSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Neue Spalte, Standardrichtung ASC (außer für Favorit)
        dbSortColumn = newSortColumn;
        dbSortDirection = (newSortColumn === 'isFavorite' || newSortColumn === 'lastUpdated') ? 'desc' : 'asc';
    }

    updateModuleDatabaseTable(); // Tabelle neu rendern mit neuer Sortierung
}

/**
 * Erstellt eine besser formatierte HTML-Struktur des Studienplans (nach Bereichen geordnet)
 * und löst den Download als .doc-Datei aus.
 */
function exportStudyPlanAsWordAreaList() {
    const planAreas = areas;
    const planCourses = courses;

    let htmlContent = `
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Studienplan nach Bereichen</title>
            <style>
                body { font-family: Calibri, sans-serif; line-height: 1.3; margin: 25px; font-size: 10pt; }
                h1, h2, h3, h4, h5, h6 { font-family: Cambria, serif; color: #2F5496; margin-top: 1.2em; margin-bottom: 0.6em; page-break-after: avoid; }
                h1 { font-size: 18pt; border-bottom: 2px solid #4472C4; padding-bottom: 6px; }
                h2 { font-size: 14pt; color: #4472C4; border-bottom: 1px solid #AEC2E0; padding-bottom: 4px; }
                h3 { font-size: 12pt; color: #5A7DBE; }
                h4 { font-size: 11pt; font-style: italic; color: #555; } /* Für tiefere Ebenen */
                p { margin-bottom: 0.5em; }
                .area-container { margin-bottom: 20px; padding-left: 15px; border-left: 3px solid; page-break-inside: avoid; } /* Verhindert Seitenumbruch innerhalb eines Bereichsblocks */
                .area-header { margin-bottom: 8px; }
                .area-details { font-size: 0.9em; color: #555; font-weight: normal; margin-left: 8px; }
                .module-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; } /* Kleinere Schrift für Tabelle */
                .module-table th, .module-table td { border: 1px solid #D0D7E5; padding: 5px 7px; text-align: left; vertical-align: top; }
                .module-table th { background-color: #E9EFF7; font-weight: bold; }
                .module-table td.lp, .module-table td.semester { text-align: center; width: 50px; } /* Feste Breite und Zentrierung */
                .module-table tr:nth-child(even) { background-color: #F8FAFC; } /* Leichter Zebra-Effekt */
                .no-modules { font-style: italic; color: #888; font-size: 9pt; margin-top: 5px; }
                 /* Farben für den linken Rand zur Hierarchieanzeige */
                 .level-0 { border-left-color: #4472C4; }
                 .level-1 { border-left-color: #5A7DBE; }
                 .level-2 { border-left-color: #84A0CE; }
                 .level-3 { border-left-color: #AEC2E0; }
                 .level-4 { border-left-color: #D6E0F1; } /* Fallback */
            </style>
        </head>
        <body>
            <h1>Studienplan nach Bereichen</h1>
    `;

    function renderAreaHierarchyForWordList(parentId = null, level = 0) {
        const filteredAreas = planAreas.filter(area => area.parentId === parentId);
        filteredAreas.sort((a, b) => a.name.localeCompare(b.name));

        filteredAreas.forEach(area => {
            const usageLP = calculateAreaUsageLP(area.id);
            const lpText = (area.creditPoints > 0 || !area.parentId) ? `(${area.creditPoints} LP)` : '';
            const usageText = (area.creditPoints > 0 || !area.parentId) ? `(Genutzt: ${usageLP} / ${area.creditPoints} LP)` : `(Genutzt: ${usageLP} LP)`;
            const headingLevel = Math.min(level + 2, 6); // Startet bei H2, max H6
            const borderColorClass = `level-${Math.min(level, 4)}`; // Klasse für Randfarbe

            // Verwende die CSS-Klasse für die Randfarbe
            htmlContent += `<div class="area-container ${borderColorClass}" style="margin-left: ${level * 10}px;">`; // Weniger aggressiver Einzug

            htmlContent += `<div class="area-header">`;
            htmlContent += `<h${headingLevel}>${area.name} ${lpText} <span class="area-details">${usageText}</span></h${headingLevel}>`;
            htmlContent += `</div>`;

            const areaModules = planCourses.filter(module => module.areaId === area.id);
            if (areaModules.length > 0) {
                htmlContent += `<table class="module-table">
                                    <thead>
                                        <tr>
                                            <th>Modul</th>
                                            <th class="semester">Sem.</th>
                                            <th class="lp">LP</th>
                                            <th>Typ</th>
                                            <th>Prüfung</th>
                                            <th>Turnus</th>
                                            <th>Sprache</th>
                                        </tr>
                                    </thead>
                                    <tbody>`;
                areaModules.sort((a,b) => a.semester - b.semester || a.title.localeCompare(b.title));
                areaModules.forEach(module => {
                    const typeString = module.type && module.type.length > 0 ? module.type.join(', ') : '-';
                    const turnus = module.semester_offered || 'k.A.';
                    const sprache = module.language || 'k.A.';
                    htmlContent += `
                        <tr>
                            <td>${module.title}</td>
                            <td class="semester">${module.semester}</td>
                            <td class="lp">${module.creditPoints}</td>
                            <td>${typeString}</td>
                            <td>${module.examType}</td>
                            <td>${turnus}</td>
                            <td>${sprache}</td>
                        </tr>
                    `;
                });
                htmlContent += `</tbody></table>`;
            } else {
                htmlContent += `<p class="no-modules">(Keine Module direkt diesem Bereich zugeordnet)</p>`;
            }

            // Rekursiver Aufruf für Unterbereiche
            renderAreaHierarchyForWordList(area.id, level + 1);
            htmlContent += `</div>`; // Schließe area-container
        });
    }

    // Starte das Rendering
    renderAreaHierarchyForWordList(null, 0);

    // Gesamtsumme (optional, da LP pro Bereich angezeigt werden)
    // const totalLPs = planCourses.reduce((sum, course) => sum + course.creditPoints, 0);
    // htmlContent += `<p style="margin-top: 30px; font-weight: bold; text-align: right; border-top: 1px solid #ccc; padding-top: 10px;">Gesamt im Plan: ${totalLPs} LP</p>`;


    htmlContent += `
        </body>
        </html>
    `;

    // Verwende die Hilfsfunktion für den Download
    triggerWordDownload(htmlContent, 'Studienplan_Bereiche');
}

function triggerWordDownload(htmlContent, baseFilename) {
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `${baseFilename}_${dateStr}.doc`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Word-Export "${a.download}" ausgelöst.`);
}
function triggerHtmlDownload(htmlContent, baseFilename) {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `${baseFilename}_${dateStr}.html`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Html-Export "${a.download}" ausgelöst.`);
}


// --- NEUE Export-Funktion: Semester als Grid ---
/**
 * Erstellt eine HTML-Tabelle des Studienplans (Semester als Spalten, LP als Zeilen)
 * und löst den Download als .doc-Datei aus.
 */
function exportStudyPlanAsWordGrid() {
    const planCourses = courses;

    // 1. Daten vorbereiten
    const modulesBySemester = planCourses.reduce((acc, module) => {
        (acc[module.semester] = acc[module.semester] || []).push(module);
        return acc;
    }, {});

    const semesters = Object.keys(modulesBySemester).map(Number).sort((a, b) => a - b);
    if (semesters.length === 0) {
        alert("Keine Module im Plan zum Exportieren als Grid.");
        return;
    }

    // Berechne max LP pro Semester und Gesamt-max LP
    let maxLpPerSemester = 0;
    const semesterLpTotals = {};
    const semesterModulesSorted = {}; // Module pro Semester sortiert speichern
    const moduleStartRow = {}; // Speichert die Start-LP-Zeile für jedes Modul { "moduleId": startRow }

    semesters.forEach(sem => {
        let currentLpSum = 0;
        semesterModulesSorted[sem] = [...modulesBySemester[sem]].sort((a,b) => a.title.localeCompare(b.title)); // Sortiere Module innerhalb des Semesters
        semesterModulesSorted[sem].forEach(mod => {
            moduleStartRow[mod.id] = currentLpSum + 1; // 1-basiert
            currentLpSum += mod.creditPoints;
        });
        semesterLpTotals[sem] = currentLpSum;
        if (currentLpSum > maxLpPerSemester) {
            maxLpPerSemester = currentLpSum;
        }
    });
     // Füge einen kleinen Puffer hinzu oder nimm ein Minimum, falls sehr wenige LP
     maxLpPerSemester = Math.max(maxLpPerSemester + 2, 30);


    // 2. HTML-Struktur aufbauen
    let htmlContent = `
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Studienplan Semester Grid</title>
            <style>
                @page { size: landscape; /* Hinweis für Querformat */ }
                body { font-family: sans-serif; font-size: 9pt; /* Kleinere Schrift */ margin: 15px; }
                h1 { text-align: center; margin-bottom: 15px; font-size: 14pt; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; /* Wichtig für gleichmäßige Spalten */ }
                th, td { border: 1px solid #a0a0a0; padding: 3px 4px; vertical-align: top; overflow: hidden; /* Verhindert Überlaufen */ text-overflow: ellipsis; /* Zeigt ... bei Überlauf */}
                th { background-color: #e0e0e0; font-weight: bold; text-align: center; }
                td.lp-label { text-align: right; font-weight: bold; background-color: #f0f0f0; width: 40px; /* Feste Breite für LP-Spalte */ }
                td.module-cell { /* Style für Zellen mit Modulen */ background-color: #f8f8ff; font-size: 8pt; line-height: 1.2; }
                td.empty-cell { background-color: #fafafa; }
                .module-title { font-weight: bold; display: block; margin-bottom: 2px; }
                .module-lp { font-size: 0.9em; color: #333; }
            </style>
        </head>
        <body>
            <h1>Studienplan - Semesterübersicht</h1>
            <table>
                <thead>
                    <tr>
                        <th class="lp-label">LP</th>
    `;

    // Header-Zeile mit Semestern
    semesters.forEach(sem => {
        htmlContent += `<th>Semester ${sem} (${semesterLpTotals[sem]} LP)</th>`;
    });
    htmlContent += `</tr></thead><tbody>`;

    // LP-Zeilen generieren
    // Wir verwenden einen Map, um zu tracken, wie viele Zeilen eine Zelle überspannt
    const rowSpanTracker = {}; // { "sem_1": 5, "sem_2": 0, ... } zählt runter

    for (let r = 1; r <= maxLpPerSemester; r++) {
        htmlContent += `<tr><td class="lp-label">${r}</td>`; // LP-Label

        semesters.forEach(sem => {
            // Prüfen, ob diese Zelle von einem vorherigen rowspan abgedeckt ist
            if (rowSpanTracker[sem] > 1) {
                rowSpanTracker[sem]--; // Eine Zeile weniger abzudecken
                // KEINE ZELLE für dieses Semester in dieser Zeile rendern
            } else {
                // Finde das Modul, das in diesem Semester *genau in dieser LP-Zeile beginnt*
                const startingModule = semesterModulesSorted[sem]?.find(mod => moduleStartRow[mod.id] === r);

                if (startingModule) {
                    // Modul gefunden, das hier beginnt
                    htmlContent += `<td class="module-cell" rowspan="${startingModule.creditPoints}">
                                        <span class="module-title">${startingModule.title}</span>
                                        <span class="module-lp">(${startingModule.creditPoints} LP)</span>
                                    </td>`;
                    // Setze den Tracker für dieses Semester
                    rowSpanTracker[sem] = startingModule.creditPoints;
                } else {
                    // Keine Modul beginnt hier, leere Zelle
                    htmlContent += `<td class="empty-cell"> </td>`;
                    rowSpanTracker[sem] = 1; // Diese Zelle ist nur eine Zeile hoch
                }
            }
        }); // Ende Semester-Loop

        htmlContent += `</tr>`; // Schließe LP-Zeile
    } // Ende LP-Zeilen-Loop


    htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    // 3. Download auslösen
    triggerWordDownload(htmlContent, 'Studienplan_SemesterGrid');
}

/**
 * Holt das gespeicherte Startsemester aus localStorage.
 * @returns {{type: string, year: number}} Das Startsemester-Objekt.
 */
function getStartSemester() {
    const stored = localStorage.getItem('studyStartSemester');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Validierung
            if ((parsed.type === 'WiSe' || parsed.type === 'SoSe') && typeof parsed.year === 'number' && parsed.year > 1990) {
                return parsed;
            }
        } catch (e) {
            console.error("Fehler beim Parsen des Startsemesters:", e);
        }
    }
    // Default zurückgeben, wenn nichts gespeichert oder ungültig
    return { type: 'WiSe', year: new Date().getFullYear() -1 }; // Default: letztes WiSe
}

/**
 * Speichert das aktuell in der UI ausgewählte Startsemester.
 */
function saveStartSemester() {
    const typeSelect = document.getElementById('startSemesterType');
    const yearInput = document.getElementById('startYearInput');
    const year = parseInt(yearInput.value);
    const type = typeSelect.value;

    if (isNaN(year) || year < 2000 || year > 3099) {
        alert("Bitte geben Sie ein gültiges Jahr (z.B. 2023) für den Studienstart ein.");
        yearInput.focus();
        return;
    }

    startSemester = { type: type, year: year };
    try {
        localStorage.setItem('studyStartSemester', JSON.stringify(startSemester));
        // Optional: Visuelles Feedback geben
        const btn = document.getElementById('saveStartSemesterBtn');
        if(btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check mr-1"></i> Gespeichert';
            btn.classList.add('bg-green-500');
            btn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('bg-green-500');
                btn.classList.add('bg-indigo-500', 'hover:bg-indigo-600');
            }, 1500);
        }
         console.log("Startsemester gespeichert:", startSemester);
         // Optional: Semestervorschläge in offenen Modals aktualisieren, falls nötig
    } catch (e) {
        console.error("Fehler beim Speichern des Startsemesters:", e);
        alert("Startsemester konnte nicht gespeichert werden.");
    }
}

/**
 * Berechnet Vorschläge für Semester basierend auf Startdatum und Turnus.
 * @param {string} turnus Der Turnus ('SoSe', 'WiSe', 'Beides', '').
 * @returns {number[]} Ein Array mit vorgeschlagenen Semesternummern (1-basiert).
 */
function calculateSemesterSuggestions(turnus) {
    const suggestions = [];
    const maxSemester = 10; // Bis zu welchem Semester sollen Vorschläge gemacht werden?
    const currentStart = getStartSemester(); // Immer aktuelles Startsemester holen

    for (let semesterNum = 1; semesterNum <= maxSemester; semesterNum++) {
        // Berechne Jahr und Typ des aktuellen Fachsemesters
        const semesterOffset = semesterNum - 1;
        let currentYear = currentStart.year;
        let currentType = currentStart.type;

        if (currentStart.type === 'SoSe') {
            currentYear += Math.floor(semesterOffset / 2);
            currentType = (semesterOffset % 2 === 0) ? 'SoSe' : 'WiSe';
        } else { // Start im WiSe
            currentYear += Math.ceil(semesterOffset / 2);
            currentType = (semesterOffset % 2 === 0) ? 'WiSe' : 'SoSe';
        }

        // Prüfe, ob der Turnus passt
        const turnusMatches =
            turnus === 'Beides' ||
            turnus === '' || // Kein Turnus -> immer anbieten? Oder nie? Hier: immer
            turnus === currentType;

        if (turnusMatches) {
            suggestions.push(semesterNum);
        }
    }
    return suggestions;
}

// Function to choose a color from the Tailwind colors for each semester
function generateColor(semester) {
    const tailwindColors = [
        'bg-blue-500',
        'bg-green-500',
        'bg-yellow-500',
        'bg-purple-500',
        'bg-pink-500',
        'bg-indigo-500',
        'bg-teal-500',
        'bg-orange-500',
        'bg-pink-500',
        'bg-emerald-500',
        'bg-cyan-500',
        'bg-violet-500',
        'bg-amber-500',
        'bg-sky-500',
        'bg-teal-500',
        'bg-fuchsia-500',
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
                lpCounter.classList.add('bg-blue-200', 'text-blue-800');
            } else {
                lpCounter.classList.add('bg-green-200', 'text-green-800');
            }
            semesterHeader.appendChild(lpCounter);
            semesterDiv.appendChild(semesterHeader);

            // Modulliste innerhalb des Semesters
            const semesterModuleList = document.createElement('div');
            semesterModuleList.className = 'space-y-0.5 rounded bg-white'; // Kompakter Abstand

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
    modal.setAttribute('data-is-db-module', isDbModule ? 'true' : 'false');
    modal.setAttribute('data-module-id', module.id);

    // ... (Felder füllen wie zuvor: Title, LP etc.)
    document.getElementById('editModuleId').value = module.id;
    document.getElementById('editModuleTitle').value = module.title;
    document.getElementById('editModuleLP').value = module.creditPoints;
    document.getElementById('editModuleExamType').value = module.examType || 'schriftlich';
    document.getElementById('editModuleLanguage').value = module.language || 'de';
    document.getElementById('editModuleOffered').value = module.semester_offered || '';


    const semesterContainer = document.getElementById('editModuleSemesterContainer'); // Container verwenden
    const areaContainer = document.getElementById('editModuleAreaContainer');          // Container verwenden
    const courseSpecificFields = document.getElementById('editModuleCourseSpecificFields');
    const typeSpecificContainer = document.getElementById('editModuleTypeSpecificContainer');


    if (isDbModule) {
        // DB-Modul spezifische Felder/Anzeige
        if (semesterContainer) semesterContainer.classList.add('hidden');
        if (courseSpecificFields) courseSpecificFields.classList.add('hidden');
        if (typeSpecificContainer) typeSpecificContainer.classList.add('hidden');
        if (areaContainer) areaContainer.classList.remove('hidden'); // Bereich immer anzeigen

        // Bereich als Textfeld für DB-Module
        let areaInput = areaContainer.querySelector('input[type="text"]');
        if (!areaInput) {
            areaContainer.innerHTML = `
                <label for="editModuleArea" class="block text-sm font-medium text-gray-700">Bereich (DB)</label>
                <input type="text" id="editModuleArea" class="border p-2 w-full rounded" placeholder="Bereichsname in DB">`;
            areaInput = areaContainer.querySelector('input[type="text"]');
        }
        areaInput.value = module.areaName || '';

        // NEU: BaseLink und Version anzeigen/bearbeiten
        let linkContainer = document.getElementById('editDbModuleLinkContainer');
        if (!linkContainer) {
            linkContainer = document.createElement('div');
            linkContainer.id = 'editDbModuleLinkContainer';
            linkContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
             linkContainer.innerHTML = `
                 <div>
                     <label for="editDbModuleBaseLink" class="block text-sm font-medium text-gray-700">Basis-Link</label>
                     <input type="url" id="editDbModuleBaseLink" class="border p-2 w-full rounded text-sm" placeholder="https://...">
                 </div>
                 <div>
                     <label for="editDbModuleVersion" class="block text-sm font-medium text-gray-700">Version</label>
                     <input type="text" id="editDbModuleVersion" class="border p-2 w-full rounded text-sm" placeholder="z.B. 2023w">
                 </div>
             `;
             // Füge es vor den Buttons ein
             const form = document.getElementById('editModuleForm');
             form.insertBefore(linkContainer, form.lastElementChild); // Vor dem Button-Container
        }
         document.getElementById('editDbModuleBaseLink').value = module.baseLink || '';
         document.getElementById('editDbModuleVersion').value = module.version || '';
         linkContainer.classList.remove('hidden');


    } else {
        // Kurs-Modul spezifische Felder/Anzeige
        if (semesterContainer) semesterContainer.classList.remove('hidden');
        if (courseSpecificFields) courseSpecificFields.classList.remove('hidden');
        if (typeSpecificContainer) typeSpecificContainer.classList.remove('hidden');
        if (areaContainer) areaContainer.classList.remove('hidden'); // Bereich immer anzeigen
         // Link Container ausblenden
         document.getElementById('editDbModuleLinkContainer')?.classList.add('hidden');


        // Bereich als Select für Kursmodule
        let areaSelect = areaContainer.querySelector('select');
        if (!areaSelect) {
            areaContainer.innerHTML = `
                 <label for="editModuleArea" class="block text-sm font-medium text-gray-700">Bereich*</label>
                 <select id="editModuleArea" class="border p-2 w-full rounded" required>
                     <option value="">Bitte wählen</option>
                     <!-- Optionen via JS -->
                 </select>`;
            areaSelect = areaContainer.querySelector('select');
        }
         populateAreaSelect(areaSelect, true, null, module.areaId); // Befülle mit Plan-Bereichen

        // Semester und andere Kurs-Felder
         document.getElementById('editModuleSemester').value = module.semester;
         document.getElementById('editModuleResponsible').value = module.responsible || '';
         document.getElementById('editModuleDepartment').value = module.department || '';
         // Checkboxen für Typ
         const typeCheckboxes = document.querySelectorAll('input[name="editModuleType"]');
         typeCheckboxes.forEach(cb => {
            cb.checked = module.type && module.type.includes(cb.value);
         });
    }

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
        const baseLink = document.getElementById('editDbModuleBaseLink').value.trim();
        const version = document.getElementById('editDbModuleVersion').value.trim() || null; // null wenn leer
        
        const updatedData = {
            title: newTitle,
            creditPoints: newLP,
            examType: newExamType,
            language: newLanguage,
            semester_offered: newOffered,
            areaName: areaName,
            baseLink: baseLink, // Speichere BaseLink
            version: version   // Speichere Version
            // `lastUpdated` wird in `updateModuleInDatabase` gesetzt
        };
        
        // Update in the database
        if (window.moduleDatabase.updateModuleInDatabase(moduleId, updatedData)) {
            updateModuleDatabaseTable(); // DB-Tabelle aktualisieren
            closeModuleEditModal();
        } else {
             alert("Fehler beim Aktualisieren des Datenbank-Moduls.");
        }

    } else {
        // Update für Kurs-Modul (im Plan)
        const newSemester = parseInt(document.getElementById('editModuleSemester').value);
        const newAreaId = document.getElementById('editModuleArea').value;

        if (isNaN(newSemester) || newSemester <= 0 || !newAreaId) {
            alert('Bitte gültiges Semester und einen Bereich für das Modul im Plan auswählen.');
            return;
        }

        const newResponsible = document.getElementById('editModuleResponsible')?.value.trim() || '';
        const newDepartment = document.getElementById('editModuleDepartment')?.value.trim() || '';
        const typeCheckboxes = document.querySelectorAll('input[name="editModuleType"]:checked');
        const selectedTypes = Array.from(typeCheckboxes).map(cb => cb.value);
        const finalTypes = selectedTypes.length > 0 ? selectedTypes : ['VL'];

        const moduleIndex = courses.findIndex(m => m.id === moduleId);
        if (moduleIndex !== -1) {
            // Hole Originaldaten um Link etc. nicht zu verlieren
            const originalCourse = courses[moduleIndex];

             courses[moduleIndex] = {
                 ...originalCourse, // Behalte ID, Link etc. bei
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
                 // lastUpdated wird für Plan-Module nicht separat getrackt
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
        } else {
            alert("Fehler: Modul im Plan nicht gefunden.");
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
    const countElement = document.getElementById('moduleDatabaseCount');
    const areaFilterSelect = document.getElementById('dbAreaFilterSelect');
    if (!tableBody) return;

    const moduleDatabase = window.moduleDatabase.loadModuleDatabase();
    const planCourses = courses;
    const planCourseTitles = new Set(planCourses.map(course => course.title.toLowerCase()));

    // 2. Filter anwenden (Basis + Erweitert)
    let filteredModules = moduleDatabase.filter(module => {
        const searchTermMatch = !dbSearchTerm ||
            (module.title?.toLowerCase().includes(dbSearchTerm)) ||
            (module.areaName?.toLowerCase().includes(dbSearchTerm)) ||
            (module.examType?.toLowerCase().includes(dbSearchTerm)) ||
            (module.id?.toLowerCase().includes(dbSearchTerm));
        const areaMatch = !dbSelectedArea || (module.areaName === dbSelectedArea);
        const advancedFilterMatch = !dbCurrentAdvancedFilter || checkAdvancedFilter(module, dbCurrentAdvancedFilter);
        return searchTermMatch && areaMatch && advancedFilterMatch;
    });

    if (countElement) {
        countElement.textContent = filteredModules.length;
    }

    let displayModules = filteredModules;
    if (!dbShowHidden) {
        displayModules = filteredModules.filter(module => !module.isHidden);
    }

    // --- Sortierung (Überarbeitet) ---
    console.log(`Sortiere DB Tabelle nach: ${dbSortColumn}, Richtung: ${dbSortDirection}`); // Debugging

    displayModules.sort((a, b) => {
        // 1. Priorität: isHidden (Nicht-Versteckte zuerst)
        if (a.isHidden !== b.isHidden) {
            return a.isHidden ? 1 : -1; // true (versteckt) kommt nach false (sichtbar)
        }

        // 2. Priorität: isFavorite (Favoriten zuerst, innerhalb ihrer hidden-Gruppe)
        if (a.isFavorite !== b.isFavorite) {
            // Wenn nach Favorit sortiert wird (dbSortColumn === 'isFavorite'),
            // kehre die Richtung um, da Favoriten normalerweise oben stehen (desc)
            // Sonst normale Priorisierung (Favoriten nach vorne).
            const favSortOrder = dbSortColumn === 'isFavorite' ? (dbSortDirection === 'desc' ? -1 : 1) : -1;
            return a.isFavorite ? favSortOrder : -favSortOrder;
        }

        // 3. Tertiäre Sortierung: Nach der ausgewählten Spalte (dbSortColumn)
        let valA = a[dbSortColumn];
        let valB = b[dbSortColumn];
        let comparison = 0;

        // Werte für Vergleich vorbereiten/normalisieren
        switch (dbSortColumn) {
            case 'creditPoints':
                valA = parseInt(valA) || 0;
                valB = parseInt(valB) || 0;
                comparison = valA - valB; // Direkter numerischer Vergleich
                break;
            case 'lastUpdated':
                // Behandle ungültige Daten als "sehr alt" für Sortierung
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
                comparison = valA - valB;
                break;
            case 'isFavorite': // Sollte durch Prio 2 abgedeckt sein, aber als Fallback
            case 'isHidden':   // Sollte durch Prio 1 abgedeckt sein, aber als Fallback
                valA = !!valA; // Konvertiere zu Boolean
                valB = !!valB;
                if (valA === valB) comparison = 0;
                else comparison = valA ? -1 : 1; // true zuerst (impliziert desc für diese Spalten)
                 // Falls die Sortierrichtung ASC ist, umkehren
                 if (dbSortDirection === 'asc') comparison *= -1;
                break;
             case 'title':
             case 'areaName':
             case 'examType':
             case 'semester_offered':
             case 'version':
             default: // Standard: String-Vergleich (case-insensitive)
                valA = String(valA ?? '').toLowerCase(); // Behandle null/undefined als leeren String
                valB = String(valB ?? '').toLowerCase();
                comparison = valA.localeCompare(valB, 'de', { sensitivity: 'base' }); // Sprachsensitiver Vergleich
                break;
        }

        // Wende die globale Sortierrichtung an (außer für boolean Spalten, wo sie schon berücksichtigt wurde)
         if (dbSortColumn !== 'isFavorite' && dbSortColumn !== 'isHidden') {
            return dbSortDirection === 'asc' ? comparison : comparison * -1;
         } else {
             return comparison; // Richtung wurde schon oben behandelt
         }
    });

    // --- Tabelle rendern (Rest der Funktion wie zuvor) ---
    tableBody.innerHTML = ''; // Leeren

    if (displayModules.length === 0) {
        // ... (Keine Module Nachricht) ...
        const colSpan = tableBody.closest('table').querySelector('thead th').parentElement.childElementCount;
        tableBody.innerHTML = `<tr><td class="border p-2 italic text-gray-500" colspan="${colSpan}">Keine Module entsprechen den aktuellen Filtern${dbShowHidden ? ' (inkl. ausgeblendeter)' : ''}.</td></tr>`;
    } else {
        displayModules.forEach(module => {
            // ... (Erstellen der Tabellenzeile `row` wie in deiner Version) ...
            const row = document.createElement('tr');
            const isInPlan = planCourseTitles.has(module.title.toLowerCase());

            if (module.isHidden) row.classList.add('opacity-50', 'italic', 'bg-gray-100');
            else if (isInPlan) row.classList.add('bg-green-50');
            else if (module.isFavorite) row.classList.add('bg-yellow-50');

            if (module.isFavorite) row.classList.add('font-semibold');

            const lastUpdatedDate = module.lastUpdated ? new Date(module.lastUpdated) : null;
            const formattedDate = lastUpdatedDate && !isNaN(lastUpdatedDate)
                 ? lastUpdatedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                 : '-';

            let addToPlanButtonHtml;
            if (isInPlan) { addToPlanButtonHtml = `<button class="text-green-600 cursor-default" disabled title="Bereits im Plan"><i class="fas fa-check-circle"></i></button>`; }
            else if (module.isHidden) { addToPlanButtonHtml = `<button class="text-gray-400 cursor-not-allowed" disabled title="Modul ist ausgeblendet"><i class="fas fa-plus"></i></button>`; }
            else { addToPlanButtonHtml = `<button class="add-to-plan-btn text-green-500 hover:text-green-700" data-id="${module.id}" title="Zum Plan hinzufügen"><i class="fas fa-plus"></i></button>`; }

             row.innerHTML = `
                <td class="border p-1.5 text-center"> <!-- Fav -->
                    <button class="favorite-db-module-btn hover:text-yellow-500 ${module.isFavorite ? 'text-yellow-400' : 'text-gray-300'}" data-id="${module.id}" title="Favorisieren">
                        <i class="fas fa-star"></i>
                    </button>
                </td>
                <td class="border p-1.5"> <!-- Titel -->
                    ${module.baseLink ?
                        `<a href="${module.baseLink}" target="_blank" class="text-blue-600 hover:underline">${module.title}</a>` :
                        module.title}
                    ${module.version ? `<span class="text-xs text-gray-400 ml-1">(v${module.version})</span>`: ''}
                </td>
                <td class="border p-1.5">${module.areaName || '-'}</td> <!-- Bereich -->
                <td class="border p-1.5 text-center">${module.creditPoints}</td> <!-- LP -->
                <td class="border p-1.5">${module.examType || '-'}</td> <!-- Prüfung -->
                <td class="border p-1.5">${module.semester_offered || '-'}</td> <!-- Turnus -->
                <td class="border p-1.5 text-xs text-gray-500 whitespace-nowrap">${formattedDate}</td> <!-- Aktualisiert -->
                <td class="border p-1.5"> <!-- Aktionen -->
                    <div class="flex gap-2 items-center justify-center">
                        ${addToPlanButtonHtml}
                        <button class="edit-db-module-btn text-blue-500 hover:text-blue-700" data-id="${module.id}" data-type="database" title="Bearbeiten"><i class="fas fa-edit"></i></button>
                        <button class="hide-db-module-btn ${module.isHidden ? 'text-green-500 hover:text-green-700' : 'text-gray-500 hover:text-gray-700'}" data-id="${module.id}" title="${module.isHidden ? 'Einblenden' : 'Ausblenden'}"><i class="fas ${module.isHidden ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
                        <button class="remove-db-module-btn text-red-500 hover:text-red-700" data-id="${module.id}" data-type="database" title="Löschen"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- Ende Tabelle rendern ---

    updateSortIndicators();
    populateDbAreaFilter(moduleDatabase);

    // Event Delegation Listener (sollte schon existieren)
    if (tableBody && !tableBody.hasAttribute('data-listeners-added')) {
        console.log("Füge Event Listener zum DB-Tabellenkörper hinzu (innerhalb update)."); // Debugging
        tableBody.setAttribute('data-listeners-added', 'true');
        tableBody.addEventListener('click', handleModuleDatabaseTableClick);
    }
}

// Hilfsfunktion zum Aktualisieren der Sortierindikatoren
function updateSortIndicators() {
    const tableHead = document.querySelector('#moduleDatabaseTable thead');
    if (!tableHead) return;
    // Alle alten Indikatoren entfernen
    tableHead.querySelectorAll('.sort-indicator').forEach(span => span.innerHTML = '');
    // Aktiven Indikator setzen
    const activeHeader = tableHead.querySelector(`th[data-sort-by="${dbSortColumn}"] .sort-indicator`);
    if (activeHeader) {
        activeHeader.innerHTML = dbSortDirection === 'asc' ? '<i class="fas fa-arrow-up ml-1 text-xs"></i>' : '<i class="fas fa-arrow-down ml-1 text-xs"></i>';
    }
}

// Hilfsfunktion zum Befüllen des Bereichsfilters
function populateDbAreaFilter(moduleDatabase) {
     const areaFilterSelect = document.getElementById('dbAreaFilterSelect');
     if (!areaFilterSelect) return;

     const currentSelectedValue = areaFilterSelect.value; // Aktuellen Wert speichern

     // Eindeutige Bereiche sammeln
     const areasInDb = [...new Set(moduleDatabase.map(m => m.areaName).filter(Boolean))].sort();

     // Optionen erstellen
     areaFilterSelect.innerHTML = '<option value="">Alle Bereiche</option>'; // Reset
     areasInDb.forEach(area => {
         const option = document.createElement('option');
         option.value = area;
         option.textContent = area;
          if (area === currentSelectedValue) { // Alten Wert wieder auswählen
             option.selected = true;
         }
         areaFilterSelect.appendChild(option);
     });
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

    const moduleDatabase = window.moduleDatabase.loadModuleDatabase(); // Neu laden für aktuellen Status
    const moduleData = moduleDatabase.find(m => m.id === moduleId); // Finde das Modul

    if (!moduleData) {
        console.warn("Modul nicht in DB gefunden für Klick:", moduleId);
        return;
    }


    if (button.classList.contains('add-to-plan-btn')) {
        promptAreaAndSemesterForDbModule(moduleData);
    }
    else if (button.classList.contains('edit-db-module-btn')) {
        openModuleEditModal(moduleData, true);
    }
    else if (button.classList.contains('remove-db-module-btn')) {
        if (confirm(`Sind Sie sicher, dass Sie das Modul "${moduleData.title}" aus der Datenbank löschen möchten?`)) {
            if (window.moduleDatabase.removeModuleFromDatabase(moduleId)) {
                updateModuleDatabaseTable(); // Update nach Löschen
            }
        }
    }
    // NEU: Favorisieren / Entfavorisieren
    else if (button.classList.contains('favorite-db-module-btn')) {
         const updatedData = { isFavorite: !moduleData.isFavorite };
         if (window.moduleDatabase.updateModuleInDatabase(moduleId, updatedData)) {
             updateModuleDatabaseTable(); // Update nach Änderung
         }
    }
    // NEU: Ausblenden / Einblenden
    else if (button.classList.contains('hide-db-module-btn')) {
        const updatedData = { isHidden: !moduleData.isHidden };
        if (window.moduleDatabase.updateModuleInDatabase(moduleId, updatedData)) {
             updateModuleDatabaseTable(); // Update nach Änderung
        }
    }
}


const filterFields = {
    title: { label: 'Titel', type: 'text' },
    areaName: { label: 'Bereich', type: 'text' }, // Später evtl. Select mit Optionen
    creditPoints: { label: 'LP', type: 'number' },
    examType: { label: 'Prüfungsform', type: 'text' }, // Später evtl. Select
    semester_offered: { label: 'Turnus', type: 'select', options: ['SoSe', 'WiSe', 'Beides', ''] },
    version: { label: 'Version', type: 'text' },
    lastUpdated: { label: 'Aktualisiert', type: 'date' }, // Für Datumsvergleiche
    isFavorite: {label: 'Favorit', type: 'boolean'},
    // isHidden wird normalerweise nicht gefiltert, außer man will sie explizit sehen
};

const filterOperators = {
    text: [
        { value: 'contains', label: 'enthält' },
        { value: 'not_contains', label: 'enthält nicht' },
        { value: 'equals', label: 'ist gleich' },
        { value: 'not_equals', label: 'ist nicht gleich' },
        { value: 'starts_with', label: 'beginnt mit' },
        { value: 'ends_with', label: 'endet mit' },
        { value: 'is_empty', label: 'ist leer' },
        { value: 'is_not_empty', label: 'ist nicht leer' },
    ],
    number: [
        { value: '=', label: '=' },
        { value: '!=', label: '!=' },
        { value: '>', label: '>' },
        { value: '>=', label: '>=' },
        { value: '<', label: '<' },
        { value: '<=', label: '<=' },
    ],
     select: [
        { value: 'equals', label: 'ist gleich' },
        { value: 'not_equals', label: 'ist nicht gleich' },
    ],
    date: [ // Vergleichsoperatoren für Datum/Zeit
        { value: 'date_equals', label: 'ist am' },
        { value: 'date_not_equals', label: 'ist nicht am' },
        { value: 'date_before', label: 'ist vor' },
        { value: 'date_after', label: 'ist nach' },
    ],
     boolean: [
        { value: 'is_true', label: 'ist wahr' },
        { value: 'is_false', label: 'ist falsch' },
    ]
};

function openFilterBuilder() {
    const modal = document.getElementById('filterBuilderModal');
    if (!modal) return;
     // Reset Builder UI
     document.getElementById('filterConditionsContainer').innerHTML = '<p id="noFiltersText" class="text-sm text-gray-500">Noch keine Bedingungen hinzugefügt.</p>';
     document.getElementById('filterNameInput').value = dbCurrentAdvancedFilter?.name || ''; // Lade Namen des aktuellen Filters
     const logic = dbCurrentAdvancedFilter?.logic || 'AND';
     document.querySelector(`input[name="filterLogic"][value="${logic}"]`).checked = true;

     // Lade vorhandene Regeln, wenn ein Filter aktiv ist
     if (dbCurrentAdvancedFilter && dbCurrentAdvancedFilter.rules) {
        dbCurrentAdvancedFilter.rules.forEach(rule => addFilterConditionRow(rule));
     }

    modal.classList.remove('hidden');
}

function closeFilterBuilder() {
    const modal = document.getElementById('filterBuilderModal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Fügt eine neue Zeile zum Filter Builder hinzu oder füllt sie basierend auf einer Regel.
 * @param {object|null} rule - Ein optionales Regelobjekt zum Vorfüllen der Zeile.
 */
function addFilterConditionRow(rule = null) {
    const container = document.getElementById('filterConditionsContainer');
    if (!container) {
        console.error("Filter-Container nicht gefunden!");
        return;
    }

    // Entferne den "Keine Bedingungen"-Text, falls vorhanden
    document.getElementById('noFiltersText')?.remove();

    // Erstelle die Haupt-Div für die Zeile
    const conditionDiv = document.createElement('div');
    conditionDiv.className = 'filter-condition-row flex items-center gap-2 p-2 border rounded bg-white';

    // --- 1. Feld-Auswahl (Select) ---
    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'filter-field border p-1 rounded text-sm flex-grow';

    // Bestimme das initial auszuwählende Feld
    let initialSelectedFieldKey = Object.keys(filterFields)[0]; // Fallback: erstes Feld
    if (rule && filterFields[rule.field]) { // Prüfe, ob das Feld aus der Regel gültig ist
        initialSelectedFieldKey = rule.field;
    } else if (rule && !filterFields[rule.field]) {
         console.warn(`Ungültiges Feld "${rule.field}" in geladener Regel. Verwende Default.`);
    }

    // Befülle das Feld-Select
    for (const [key, config] of Object.entries(filterFields)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = config.label;
        if (key === initialSelectedFieldKey) {
            option.selected = true; // Wähle das bestimmte Feld vor
        }
        fieldSelect.appendChild(option);
    }

    // --- 2. Operator-Auswahl (Select) ---
    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'filter-operator border p-1 rounded text-sm w-32'; // Feste Breite kann helfen

    // --- 3. Wert-Eingabe (Container) ---
    const valueInputContainer = document.createElement('div');
    valueInputContainer.className = 'filter-value-container flex-grow'; // Nimmt verfügbaren Platz

    // --- 4. Löschen-Button ---
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '<i class="fas fa-times text-red-500 hover:text-red-700"></i>';
    deleteBtn.className = 'px-1 py-1 flex-shrink-0'; // Verhindert Schrumpfen
    deleteBtn.title = "Bedingung entfernen";
    deleteBtn.onclick = () => {
        conditionDiv.remove();
        // Prüfen, ob es die letzte Bedingung war
        if (container.querySelectorAll('.filter-condition-row').length === 0) {
            container.innerHTML = '<p id="noFiltersText" class="text-sm text-gray-500">Noch keine Bedingungen hinzugefügt.</p>';
        }
    };

    // --- Hilfsfunktion: Aktualisiert Operator und Wert basierend auf dem Feld ---
    const updateOperatorAndValue = (selectedFieldKey) => {
        console.log(`Aktualisiere Operator/Wert für Feld: ${selectedFieldKey}`); // Debugging

        const fieldConfig = filterFields[selectedFieldKey];

        // **Robuste Prüfung auf fieldConfig**
        if (!fieldConfig || !fieldConfig.type) {
            console.error(`Konfiguration oder Typ für Feld "${selectedFieldKey}" fehlt oder ist ungültig!`, fieldConfig);
            operatorSelect.innerHTML = '<option value="">Fehler</option>';
            valueInputContainer.innerHTML = '';
            return;
        }

        // Passende Operatoren holen (Fallback auf Text)
        const availableOperators = filterOperators[fieldConfig.type] || filterOperators.text;
        if (!availableOperators || availableOperators.length === 0) {
             console.error(`Keine Operatoren für Typ "${fieldConfig.type}" gefunden!`);
             operatorSelect.innerHTML = '<option value="">Fehler</option>';
             valueInputContainer.innerHTML = '';
             return;
        }

        // Operator-Select leeren und neu befüllen
        operatorSelect.innerHTML = '';
        let isInitialCall = operatorSelect.options.length === 0; // Prüfen, ob es der erste Aufruf für diese Zeile ist
        let selectedOperatorValue = null;

        // Bestimme den Operator, der ausgewählt werden soll
        // 1. Wenn eine Regel geladen wird UND das Feld passt UND der Operator gültig ist
         if (rule && rule.field === selectedFieldKey && availableOperators.some(op => op.value === rule.operator)) {
            selectedOperatorValue = rule.operator;
        }
        // 2. Sonst nimm den ersten verfügbaren Operator
        else {
            selectedOperatorValue = availableOperators[0].value;
        }


        availableOperators.forEach(op => {
            const option = document.createElement('option');
            option.value = op.value;
            option.textContent = op.label;
            if (op.value === selectedOperatorValue) {
                option.selected = true;
            }
            operatorSelect.appendChild(option);
        });


        // Wertfeld leeren und neu erstellen
        valueInputContainer.innerHTML = '';
        let inputElement = null; // Wichtig: zurücksetzen

        // Bestimme, ob der aktuell ausgewählte Operator ein Wertfeld benötigt
        const operatorNeedsValue = !['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(selectedOperatorValue);


        // Erstelle das passende Eingabeelement basierend auf dem Feldtyp
         switch (fieldConfig.type) {
            case 'number':
                inputElement = document.createElement('input');
                inputElement.type = 'number';
                inputElement.step = 'any';
                break;
            case 'date':
                inputElement = document.createElement('input');
                inputElement.type = 'date';
                break;
            case 'select':
                if (fieldConfig.options && Array.isArray(fieldConfig.options)) {
                    inputElement = document.createElement('select');
                    fieldConfig.options.forEach(optValue => {
                        const opt = document.createElement('option');
                        opt.value = optValue;
                        opt.textContent = optValue === '' ? 'k.A.' : optValue; // Zeige 'k.A.' für leere Option
                        inputElement.appendChild(opt);
                    });
                } else {
                    console.warn(`Feld "${selectedFieldKey}" ist Typ 'select', aber 'options' fehlen oder sind kein Array. Fallback auf Text.`);
                    inputElement = document.createElement('input'); // Fallback
                    inputElement.type = 'text';
                }
                break;
            case 'boolean':
                // Kein Eingabefeld für Boolean nötig, der Operator reicht
                break;
            default: // 'text' und unbekannte Typen
                inputElement = document.createElement('input');
                inputElement.type = 'text';
                break;
        }


        // Wenn ein Eingabeelement erstellt wurde
        if (inputElement) {
            inputElement.className = 'filter-value border p-1 rounded text-sm w-full';
            // Setze den Wert nur, wenn eine Regel geladen wird und das Feld übereinstimmt
            if (rule && rule.field === selectedFieldKey) {
                 inputElement.value = rule.value ?? ''; // Setze Wert aus Regel
            }
            valueInputContainer.appendChild(inputElement);
            // Sichtbarkeit basierend auf dem Operator setzen
            inputElement.style.display = operatorNeedsValue ? '' : 'none';
        }

        // Listener für Operator-Änderung hinzufügen (wird ggf. überschrieben, das ist ok)
        operatorSelect.onchange = () => {
            const currentOperatorNeedsValue = !['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(operatorSelect.value);
            const currentInputElement = valueInputContainer.querySelector('.filter-value'); // Finde das aktuelle Input-Element
            if (currentInputElement) {
                currentInputElement.style.display = currentOperatorNeedsValue ? '' : 'none';
                if (!currentOperatorNeedsValue) currentInputElement.value = '';
            }
        };
    }; // Ende von updateOperatorAndValue

    // --- Event Listener für Feld-Änderung ---
    // Ruft die Hilfsfunktion auf, wenn der Benutzer das Feld wechselt
    fieldSelect.addEventListener('change', (e) => updateOperatorAndValue(e.target.value));

    // --- Elemente zur Zeile hinzufügen ---
    conditionDiv.appendChild(fieldSelect);
    conditionDiv.appendChild(operatorSelect);
    conditionDiv.appendChild(valueInputContainer);
    conditionDiv.appendChild(deleteBtn);

    // --- Zeile zum Container hinzufügen ---
    container.appendChild(conditionDiv);

    // --- Initialen Zustand für Operator und Wert setzen ---
    // Rufe die Update-Funktion mit dem initial ausgewählten Feld auf,
    // nachdem alle Elemente im DOM sind.
    console.log(`Initialer Aufruf von updateOperatorAndValue für Feld: ${initialSelectedFieldKey}`); // Debugging
    updateOperatorAndValue(initialSelectedFieldKey);

} // Ende von addFilterConditionRow

function collectFilterFromBuilder() {
     const conditions = [];
     const container = document.getElementById('filterConditionsContainer');
     const rows = container.querySelectorAll('.filter-condition-row');

     rows.forEach(row => {
         const field = row.querySelector('.filter-field').value;
         const operator = row.querySelector('.filter-operator').value;
         const valueInput = row.querySelector('.filter-value'); // Kann null sein für boolean
         let value = valueInput ? valueInput.value : null;

         // Konvertiere Wert basierend auf Feldtyp
          const fieldType = filterFields[field]?.type;
          if (fieldType === 'number') {
              value = parseFloat(value);
              if (isNaN(value) && !['is_empty', 'is_not_empty'].includes(operator)) return; // Ungültige Zahl ignorieren
          } else if (fieldType === 'boolean') {
              // Wert ist implizit durch Operator bestimmt
              value = (operator === 'is_true');
          } else if (value === null && !['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(operator)) {
               // Wenn ein Wert erwartet wird, aber keiner da ist (außer bei leeren/nicht leeren/boolschen Checks)
               return; // Ignoriere unvollständige Regel
          }


         conditions.push({ field, operator, value });
     });

     const logic = document.querySelector('input[name="filterLogic"]:checked').value;

     if (conditions.length === 0) return null; // Kein gültiger Filter

     return {
         id: dbCurrentAdvancedFilter?.id || 'temp_' + Date.now(), // ID für Wiedererkennung
         name: document.getElementById('filterNameInput').value.trim() || `Filter ${new Date().toLocaleTimeString()}`,
         logic: logic,
         rules: conditions
     };
}

function applyAdvancedFilterFromBuilder() {
    dbCurrentAdvancedFilter = collectFilterFromBuilder();
    // Setze das Haupt-Dropdown zurück, da der Builder angewendet wurde
    document.getElementById('dbSavedFilterSelect').value = '';
    closeFilterBuilder();
    updateModuleDatabaseTable();
}

function saveAndApplyAdvancedFilter() {
     const newFilter = collectFilterFromBuilder();
     if (!newFilter || newFilter.rules.length === 0) {
         alert("Filter enthält keine gültigen Bedingungen zum Speichern.");
         return;
     }

     const filterName = document.getElementById('filterNameInput').value.trim();
      if (!filterName) {
         alert("Bitte geben Sie einen Namen für den Filter ein.");
         document.getElementById('filterNameInput').focus();
         return;
     }
      newFilter.name = filterName; // Setze den Namen
      newFilter.id = 'filter_' + filterName.replace(/\s+/g, '_') + '_' + Date.now(); // Eindeutige ID generieren

     // Prüfen, ob Filter mit gleichem Namen existiert
     const existingIndex = savedDbFilters.findIndex(f => f.name === newFilter.name);
     if (existingIndex !== -1) {
         if (!confirm(`Ein Filter mit dem Namen "${newFilter.name}" existiert bereits. Möchten Sie ihn überschreiben?`)) {
             return;
         }
         savedDbFilters[existingIndex] = newFilter; // Überschreiben
     } else {
         savedDbFilters.push(newFilter); // Neu hinzufügen
     }

     if (window.moduleDatabase.saveDbFilters(savedDbFilters)) {
         populateSavedFiltersDropdown();
         // Wähle den neu gespeicherten Filter im Dropdown aus
         document.getElementById('dbSavedFilterSelect').value = newFilter.id;
          dbCurrentAdvancedFilter = newFilter; // Direkt anwenden
          closeFilterBuilder();
          updateModuleDatabaseTable();
     } else {
          alert("Fehler beim Speichern des Filters.");
     }

}

function populateSavedFiltersDropdown() {
    const select = document.getElementById('dbSavedFilterSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Kein Filter</option>'; // Reset
    savedDbFilters.forEach(filter => {
        const option = document.createElement('option');
        option.value = filter.id; // Verwende ID als Wert
        option.textContent = filter.name;
        select.appendChild(option);
    });
     // Wähle den aktuell angewendeten Filter vor, falls er gespeichert ist
     if(dbCurrentAdvancedFilter && savedDbFilters.some(f => f.id === dbCurrentAdvancedFilter.id)) {
         select.value = dbCurrentAdvancedFilter.id;
     }
}

function applySavedFilter(event) {
    const filterId = event.target.value;
    if (!filterId) {
        dbCurrentAdvancedFilter = null; // Keinen Filter anwenden
    } else {
        dbCurrentAdvancedFilter = savedDbFilters.find(f => f.id === filterId);
    }
    updateModuleDatabaseTable();
}

function clearAllDbFilters() {
    dbSearchTerm = '';
    dbSelectedArea = '';
    dbCurrentAdvancedFilter = null;
    // Setze UI Elemente zurück
    document.getElementById('dbSearchInput').value = '';
    document.getElementById('dbAreaFilterSelect').value = '';
    document.getElementById('dbSavedFilterSelect').value = '';
    updateModuleDatabaseTable();
}

// Funktion zum Speichern der aktuellen Filter (ohne Builder)
function saveCurrentFilterSetup() {
     // Erstelle ein temporäres Filterobjekt aus den aktuellen Einstellungen
     // Nur sinnvoll, wenn mindestens Suche oder Bereichsfilter aktiv ist
     if (!dbSearchTerm && !dbSelectedArea && !dbCurrentAdvancedFilter) {
         alert("Keine aktiven Filter zum Speichern ausgewählt (außer Sortierung). Bitte verwenden Sie den Filter Builder für komplexere Filter.");
         return;
     }

     let filterToSave = {
         id: 'filter_' + Date.now(),
         name: '', // Benutzer muss Namen eingeben
         logic: 'AND', // Standard für einfache Filter
         rules: []
     };

     if (dbSearchTerm) {
         // Annahme: Suche betrifft Titel
         filterToSave.rules.push({ field: 'title', operator: 'contains', value: dbSearchTerm });
     }
     if (dbSelectedArea) {
         filterToSave.rules.push({ field: 'areaName', operator: 'equals', value: dbSelectedArea });
     }
      // Füge Regeln des aktuellen Advanced Filters hinzu, falls vorhanden
      if (dbCurrentAdvancedFilter && dbCurrentAdvancedFilter.rules.length > 0) {
          filterToSave.rules.push(...dbCurrentAdvancedFilter.rules);
          filterToSave.logic = dbCurrentAdvancedFilter.logic; // Übernehme Logik
      }

     if (filterToSave.rules.length === 0) {
          alert("Keine Filterbedingungen zum Speichern gefunden.");
          return;
     }

     const filterName = prompt("Geben Sie einen Namen für diese Filterkonfiguration ein:", `Filter ${new Date().toLocaleTimeString()}`);
     if (!filterName) return; // Abbruch

     filterToSave.name = filterName;
     filterToSave.id = 'filter_' + filterName.replace(/\s+/g, '_') + '_' + Date.now();


     const existingIndex = savedDbFilters.findIndex(f => f.name === filterName);
      if (existingIndex !== -1) {
         if (!confirm(`Ein Filter mit dem Namen "${filterName}" existiert bereits. Möchten Sie ihn überschreiben?`)) {
             return;
         }
         savedDbFilters[existingIndex] = filterToSave;
     } else {
         savedDbFilters.push(filterToSave);
     }

     if (window.moduleDatabase.saveDbFilters(savedDbFilters)) {
         populateSavedFiltersDropdown();
         document.getElementById('dbSavedFilterSelect').value = filterToSave.id; // Wähle ihn aus
          dbCurrentAdvancedFilter = filterToSave; // Wende ihn auch an
          updateModuleDatabaseTable();
          alert(`Filter "${filterName}" gespeichert.`);
     } else {
          alert("Fehler beim Speichern des Filters.");
     }
}


function checkAdvancedFilter(module, filter) {
    if (!filter || !filter.rules || filter.rules.length === 0) return true; // Kein Filter -> passt immer

    const logic = filter.logic || 'AND'; // Standard ist AND
    let results = [];

    for (const rule of filter.rules) {
        let moduleValue = module[rule.field];
        let ruleValue = rule.value;
        const operator = rule.operator;

        // Normalisierung für Vergleiche
        if (typeof moduleValue === 'string') moduleValue = moduleValue.toLowerCase();
        if (typeof ruleValue === 'string') ruleValue = ruleValue.toLowerCase();

         // Behandlung von Datumswerten
         if (filterFields[rule.field]?.type === 'date' && operator.startsWith('date_')) {
             moduleValue = moduleValue ? new Date(moduleValue).setHours(0,0,0,0) : null; // Nur Datumsteil vergleichen
             ruleValue = ruleValue ? new Date(ruleValue).setHours(0,0,0,0) : null;
              if (moduleValue === null || ruleValue === null) {
                   results.push(false); // Kein gültiger Datumsvergleich möglich
                   continue;
              }
         } else if (filterFields[rule.field]?.type === 'number') {
              moduleValue = parseFloat(moduleValue);
              ruleValue = parseFloat(ruleValue); // Regelwert wurde schon beim Sammeln geparst
               if (isNaN(moduleValue) && !['is_empty', 'is_not_empty'].includes(operator)) {
                    results.push(false); // Ungültiger Zahlenwert im Modul
                    continue;
               }
         } else if (filterFields[rule.field]?.type === 'boolean') {
              // Der Wert ist im Operator kodiert
         } else if (moduleValue === null || moduleValue === undefined) {
              moduleValue = ''; // Behandle null/undefined wie leeren String für Textvergleiche
         }


        let match = false;
        switch (operator) {
            // Text
            case 'contains': match = String(moduleValue).includes(String(ruleValue)); break;
            case 'not_contains': match = !String(moduleValue).includes(String(ruleValue)); break;
            case 'equals': match = String(moduleValue) === String(ruleValue); break;
            case 'not_equals': match = String(moduleValue) !== String(ruleValue); break;
            case 'starts_with': match = String(moduleValue).startsWith(String(ruleValue)); break;
            case 'ends_with': match = String(moduleValue).endsWith(String(ruleValue)); break;
            case 'is_empty': match = moduleValue === '' || moduleValue === null || moduleValue === undefined; break;
            case 'is_not_empty': match = moduleValue !== '' && moduleValue !== null && moduleValue !== undefined; break;
            // Number
            case '=': match = moduleValue === ruleValue; break;
            case '!=': match = moduleValue !== ruleValue; break;
            case '>': match = moduleValue > ruleValue; break;
            case '>=': match = moduleValue >= ruleValue; break;
            case '<': match = moduleValue < ruleValue; break;
            case '<=': match = moduleValue <= ruleValue; break;
             // Date
             case 'date_equals': match = moduleValue === ruleValue; break;
             case 'date_not_equals': match = moduleValue !== ruleValue; break;
             case 'date_before': match = moduleValue < ruleValue; break;
             case 'date_after': match = moduleValue > ruleValue; break;
             // Boolean
              case 'is_true': match = !!moduleValue; break; // !! konvertiert zu boolean
              case 'is_false': match = !moduleValue; break;

            default: match = false; // Unbekannter Operator
        }
        results.push(match);
    } // Ende der Loop über Regeln

    // Logik anwenden
    if (logic === 'AND') {
        return results.every(res => res === true); // Alle müssen wahr sein
    } else { // OR
        return results.some(res => res === true); // Mindestens einer muss wahr sein
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
    const moduleTurnusSpan = document.getElementById('dbModalModuleTurnus'); // NEU
    const moduleDataInput = document.getElementById('dbModalModuleData');
    const suggestionsContainer = document.getElementById('dbModuleSemesterSuggestions'); // NEU

    // Modal-Inhalt füllen
    moduleNameSpan.textContent = moduleData.title;
    moduleLPSpan.textContent = moduleData.creditPoints;
    moduleTurnusSpan.textContent = moduleData.semester_offered || 'k.A.'; // Zeige Turnus an
    moduleDataInput.value = JSON.stringify(moduleData);

    // Bereichs-Dropdown füllen und versuchen vorzuwählen
    let preselectedAreaId = null;
    if (moduleData.areaName) {
        // Finde die areaId im *Plan*, die dem areaName aus der DB entspricht (case-insensitive, cleaned)
        const cleanDbAreaName = cleanAreaName(moduleData.areaName);
        const matchingPlanArea = areas.find(a => cleanAreaName(a.name) === cleanDbAreaName);
        if (matchingPlanArea) {
            preselectedAreaId = matchingPlanArea.id;
        }
    }
    populateAreaSelect(areaSelect, true, null, preselectedAreaId); // Mit Vorauswahl

    // Semester zurücksetzen und Vorschläge generieren/anzeigen
    semesterInput.value = '1'; // Standardwert
    suggestionsContainer.innerHTML = ''; // Alte Vorschläge leeren

    const turnus = moduleData.semester_offered || 'Beides'; // Default zu 'Beides' wenn leer
    const suggestions = calculateSemesterSuggestions(turnus);

    if (suggestions.length > 0) {
         // Ersten Vorschlag als Default setzen
         semesterInput.value = suggestions[0];

         suggestions.forEach(semNum => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = semNum;
            button.className = 'bg-gray-200 hover:bg-blue-200 text-xs px-1.5 py-0.5 rounded';
            button.onclick = () => {
                semesterInput.value = semNum;
                 // Optional: Fokus auf Hinzufügen-Button setzen
                 // modal.querySelector('button[type="submit"]').focus();
            };
            suggestionsContainer.appendChild(button);
        });
    }


    // Fehler-Nachrichten zurücksetzen
    document.getElementById('dbModalAreaError').classList.add('hidden');
    document.getElementById('dbModalSemesterError').classList.add('hidden');

    // Event Listener (wie zuvor)
    form.onsubmit = handleDbModuleAddConfirm;
    document.getElementById('closeDbAddModalBtn').onclick = closeDbModuleAddModal;
    document.getElementById('cancelDbAddBtn').onclick = closeDbModuleAddModal;

    modal.classList.remove('hidden');
    areaSelect.focus();
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