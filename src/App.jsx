import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
    BaseEdge,
    Connection,
    ConnectionMode,
    Node, MarkerType
} from 'reactflow';
import { SmartBezierEdge } from '@tisoap/react-flow-smart-edge'
import { ReactFlowProvider } from 'react-flow-renderer'
import 'reactflow/dist/style.css';
import './styles/styles.css'


import NodeContextMenu from './components/NodeContextMenu';
import EdgeContextMenu from './components/EdgeContextMenu';
import SelfConnectingEdge from './elements/SelfConnectingEdge';
import CustomEdge from './components/CustomEdge';
import BaseNode from './elements/BaseNode';
import Sidebar from './components/Sidebar';


import {initialNodes, initialEdges} from './elements/initial-setup2';
import {initialNodes3, initialEdges3} from './elements/initial-setup3';
import {exampleNodes, exampleEdges} from './elements/exampleDFA';
import {miniNodes, miniEdges} from './elements/mini-setup';
import Partitioner from './components/Partitioner';

import {findPartitionForState, findTargetState} from './components/Partitioner';

import NodeLabelList from './components/NodeLabelList';

const EdgeTypes = {

    selfconnecting: SelfConnectingEdge,
    custom: CustomEdge,

};

const NodeTypes = {
    basenode: BaseNode,
};


function App() {


    //Zustands Management
    const [edgemenu, setEdgeMenu] = useState(null);
    const [menu, setMenu] = useState(null);

    const [isDfaResult, setIsDfaResult, onChange] = useState(null);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);


    const [alphabet, setAlphabet] = useState([]);

    const [implyTrashStates, setImplyTrashStates] = useState(false);

    //umschalten ob Müllzustände impliziert werden "true" oder nicht "false"
    const toggleImplyTrashStates = () => {
        setImplyTrashStates(!implyTrashStates);
    };

    // Beispiel 1
    const plainField = () => {
        setEdgeMenu(null);
        setMenu(null);
        setNodes(prev => exampleNodes);
        setEdges(prev => exampleEdges);
        setAlphabet(['a', 'b', 'c']);
    }
    //minimalKonfiguration als Start
    const miniField = () => {
        setEdgeMenu(null);
        setMenu(null);
        setNodes(prev => miniNodes);
        setEdges(prev => miniEdges);
        setAlphabet(['a']);
    }

    //beispiel 3

    const exampleField3 = () => {
        setEdgeMenu(null);
        setMenu(null);
        setNodes(prev => initialNodes3);
        setEdges(prev => initialEdges3);

    }

    //Erzeut die Startpartitionen mit Endzuständen und restlichen Zuständen
    const initialPartition = (nodes) => {
        const endStates = nodes.filter(node => node.data.output);
        const nonEndStates = nodes.filter(node => !node.data.output);
        return [nonEndStates, endStates];
    };

    const [partitions, setPartitions] = useState(initialPartition(nodes));
    const [partitionsHistory, setPartitionsHistory] = useState([]);

    //States für die Ausgabe des Äquivalenzautomaten
    const [finalnodes, setfinalNodes, onfinalNodesChange] = useNodesState([]);
    const [finaledges, setfinalEdges, onfinalEdgesChange] = useEdgesState([]);

    // States für die Anzeige der History mit Details
    const [showDetails, setShowDetails] = useState(false);
    const [detailsVisibility, setDetailsVisibility] = useState({}); // State für das Ein-/Ausblenden der Details
    const [miniKonfigVisibility, setMiniKonfigVisibility] = useState(false);

    //States für Hovering

    const [highlightHoverSymbol, setHighlightHoverSymbol] = useState(null);
    const [highlightedPartition, setHighlightedPartition] = useState(null);

    //States für MinimizedFinishedCheck
    const[isDFAMinimized, setIsDFAMinimized] = useState (false);

    /**
     * das Alphabet soll automatisch aktualisiert werden, sobald neue symbole hinzukommen!
     * Der versteckte Knoten mit dem ungelabelten Inputknoten ist davon ausgenommen
     */
    useEffect(() => {
        const symbols = new Set();
        edges.filter(edge => !edge.source.includes('hidden') && !edge.target.includes('hidden')).forEach(edge => {
            const edgeSymbols = edge.label.split(/[,;\s]\s*/).map(symbol => symbol.trim());
            edgeSymbols.forEach(symbol => {
                if (symbol !== '') {
                    symbols.add(symbol);
                }
            });
        });
        setAlphabet(Array.from(symbols));
    }, [edges]);


    //Wenn der Automat geändert wird, werden die Partitionen und Auswertungen  initialisiert.
    useEffect(() => {
        const updatedPartitions = initialPartition(nodes.filter(node => node.style?.visibility !== 'hidden'));
        setPartitions(updatedPartitions);
        setPartitionsHistory([{ symbol: 'Start', partitions: updatedPartitions, changed: false }]);
        setIsDfaResult(null);
        setIsDFAMinimized(false);
        setMiniKonfigVisibility(false);
        setDetailsVisibility({});

    }, [nodes, alphabet, edges, implyTrashStates]);

    /**
     * Refs für die einzelnen Komponenten, damit kan nich dynamisch auf die Größenänderungen reagieren
     * @type {{current: (unknown|null)}}
     */
    const ref = useRef(null);
    const refFinal = useRef(null);
    const kontrollContainerRef = useRef(null);
    const topTextRef = useRef(null);

    /**
     * Beim Klick auf das Canvas sollen alle Menüs geschlossen werden
     * @type {(function(): void)|*}
     */
    const onPaneClick = useCallback(() => {
        setMenu(null); // Set das Menu zurück
        setEdgeMenu(null); // Setz das edgeMenu zurück
        setHighlightHoverSymbol(null)

        setHighlightedPartition(null);  // Reset wenn Komponente abgemountet wird

    }, [setMenu, setEdgeMenu]);

    /**
     * Steuert welche Detaisl gerade aufgeklappt werden sollen
     */

    const toggleDetailsVisibility = (index) => {
        setDetailsVisibility(prevState => ({
            ...prevState,
            [index]: !prevState[index]
        }));
    };

    /**
     * Steuert ob die Minimalautomatkonfiguration aufgeklappt werden soll
     */

    const toggleMiniKonfigVisibility = () => {
        setMiniKonfigVisibility(!miniKonfigVisibility);
    };



    /**
     * Erzeugt das Kontextmenü für Kanten
     * @type {(function(*, *): void)|*}
     */

    //Kante umbenennen und löschen
    const onEdgeContextMenu = useCallback((event,edge) => {
        // Kein normales Kontextmenü
        event.preventDefault();
                //Koordinaten de clicks
                const clickX = event.clientX;
                const clickY = event.clientY;

                //Größe des Kontainers daneben
                const kontrollContainer = kontrollContainerRef.current.getBoundingClientRect();
                const kontrollContainerWidth = kontrollContainer.width;
                const pane = ref.current.getBoundingClientRect();

                const topText = topTextRef.current.getBoundingClientRect();
                const topTextHeight = topText.height;

                const left = Math.min(clickX- kontrollContainerWidth , pane.width - kontrollContainerWidth - 200);
                // limit die linke Position mit Breite des Kontrollcontainer
                const top = Math.min(clickY -topTextHeight, pane.height -topTextHeight - 200);
                //hover enhanced



                setEdgeMenu({
                    className:"context-menu",
                id: edge.id,
                top: top,
                left: left,
                right: event.clientX >= pane.width - 200 && pane.width - event.clientX,
                bottom:
                    event.clientY >= pane.height - 200 && pane.height - event.clientY,
                partitions: partitions,
                edges: edges,
                partitionDFAWithEdge: partitionDFAWithEdge,
                setPartitions: setPartitions,
                setHighlightHoverSymbol: setHighlightHoverSymbol,
                highlightHoverSymbol: highlightHoverSymbol,
                    setHighlightedPartition: setHighlightedPartition,
                    highlightedPartition: highlightedPartition,
                isDfaResult: isDfaResult,
                    isDFAMinimized: isDFAMinimized,
            });


        },
        [setEdgeMenu, edges, nodes, partitions, highlightHoverSymbol , highlightedPartition,isDfaResult],
    );

    /**
     * Erzeugen einer Kante, wenn von einer Source Handle per DragnDrop zu einer TargetHandle gezogen wurde
     * Erzeugt
     * @type {(function(*): void)|*}
     */
    const onConnect = useCallback(
        (params) => {
            const label = prompt("Bitte geben Sie das Label für die neue Kante ein:", alphabet[0]);

            if (label !== null) {
                if (params.source === params.target) {
                    const newEdge = {
                        id: `edge-${params.source}-${params.target}`,
                        source: params.source,
                        target: params.target,
                        label: label,
                        type: "selfconnecting",
                        markerEnd: { type: MarkerType.ArrowClosed },
                    };
                    setEdges((edges) => [...edges, newEdge]);
                } else {

                    // Prüfen, ob eine entgegenlaufende Kante existiert
                    const existingEdge = edges.find(
                        (edge) => edge.source === params.target && edge.target === params.source
                    );

                    const newEdge = {
                        id: `edge-${params.source}-${params.target}`,
                        source: params.source,
                        target: params.target,
                        label: label,
                        data: { label: label },
                        type: existingEdge ? "custom" : "default", // Custom nur für neue kollisionen verwenden
                        markerEnd: { type: MarkerType.ArrowClosed },
                    };

                    // Aktualisiere die Edge-Liste mit der zusätzlichen Kante
                    setEdges((edges) => [...edges, newEdge]);
                }
            }
        },
        [setEdges, edges, alphabet]
    );


    /**
     * Drag an drop neuer Knoten
     */
    let id = 0;
    const getId = () => `CopyZustand_${id++}`;
    const [reactFlowInstance, setReactFlowInstance] = useState(null);


    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const newLabel = prompt("Bitte geben Sie das Label für den neuen Zustand ein:");
            if (!newLabel) {
                // Abbrechen, wenn kein Label eingegeben wurde
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            let newNode;

            switch (type) {
                case 'default':
                    newNode = {
                        id: newLabel,
                        data: { label: newLabel },
                        position,
                        targetPosition: 'left',
                        sourcePosition: 'right',
                    };
                    break;
                case 'input':
                    newNode = {
                        id: newLabel,
                        data: { label: newLabel, input: true },
                        position,
                        targetPosition: 'left',
                        sourcePosition: 'right',
                        style: { backgroundColor: '#a4d36b' },
                    };

                    break;
                case 'output':
                    newNode = {
                        id: newLabel,
                        data: { label: newLabel, output: true },
                        position,
                        targetPosition: 'left',
                        sourcePosition: 'right',
                        style: { border: '3px solid black', borderStyle: 'double' },
                    };
                    break;
                default:

                    newNode = {
                        id: newLabel,
                        data: { label: newLabel },
                        position,
                        targetPosition: 'left',
                        sourcePosition: 'right',
                    };
                    break;
            }

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance],
    );


    /**
     * Öffnet das Kontextmenü der Knoten
     * @type {(function(*, *): void)|*}
     */


    const onNodeContextMenu = useCallback(
        (event, node) => {
            // Kein normales Kontextmenü
            event.preventDefault();

            //Koordinaten de clicks
            const clickX = event.clientX;
            const clickY = event.clientY;

            const pane = ref.current.getBoundingClientRect();

            //Größe des Kontainers daneben
            const kontrollContainer = kontrollContainerRef.current.getBoundingClientRect();
            const kontrollContainerWidth = kontrollContainer.width;

            const topText = topTextRef.current.getBoundingClientRect();
            const topTextHeight = topText.height;

            // Sicherstellen, dass das Menü nicht neben dem Fenster gerendert wrid
            const left = Math.min(clickX- kontrollContainerWidth , pane.width - kontrollContainerWidth - 100);
            // Begrenze die linke Position entsprechend der Breite des .Kontrollcontainer
            // Grenze auch nach oben aber amnn kanns auh übertreiben
            const top = Math.min(clickY -topTextHeight, pane.height -topTextHeight - 100);

            setMenu({
                id: node.id,
                left,
                top,
            });
        },
        [setMenu],
    );

    /**
     * Der Klick auf den Prüfbutton erzeugt eine Prüfinstanz auf DFA Konformitat und setzt den Wert, so das neu gerendert wird
     */

    const checkIsDFA = () => {
        setIsDfaResult((prev) => null);
        let result = isDFA(nodes, edges, alphabet);
        setIsDfaResult(result);

    };


    /**
     * Genau ein Startzustand: Es wird sichergestellt, dass genau ein Startzustand vorhanden ist.
     * Validität der Kantenlabels: Es wird überprüft, ob alle Kantenlabels gültige Symbole des Alphabets enthalten.
     * Eindeutigkeit der Übergänge: Für jedes Symbol in jedem Zustand darf es höchstens einen Übergang geben.
     * Erreichbarkeit aller Zustände: Alle Zustände müssen vom Startzustand aus erreichbar sein.
     *
     * TODO Endzustandbehandlung
     *
     * Hat jetzt einen Schalter um TrashStates zu implizieren oder nur vollständige Dfas zu akzeptieren
     *
     * @param nodes
     * @param edges
     * @param alphabet
     * @returns {boolean}
     */

    function isDFA(nodes, edges, alphabet) {
        nodes = nodes.filter(node => node.style?.visibility !== 'hidden')
        edges = edges.filter(edge => !edge.source.includes('hidden') )


        if (!nodes || !edges || !alphabet) {
            console.error('Einer der Inputs (nodes, edges, alphabet) ist nicht richtig definiert.');
            return false;
        }

        // Überprüfung auf genau einen Startzustand
        const startStates = nodes.filter(node => node.data.input == true);
        if (startStates.length !== 1) {
            console.error("Es muss genau einen Startzustand geben.");
            alert("Es muss genau einen Startzustand geben.")
            return false;
        }
        const startStateId = startStates[0].id;
        const transitions = new Map();

        const endStates = nodes.filter(node => node.data.output == true);
        if (endStates.length == 0) {
            console.error("Es muss mindestens einen Endzustand geben.");
            alert("Es muss mindestens einen Endzustand geben.")
            return false;
        }

        // Initialisieren der Transitions Map mit leeren Sets
        nodes.forEach(node => {
            alphabet.forEach(symbol => {
                const key = `${node.id}-${symbol}`;
                transitions.set(key, null); //null für evtl. Müllzustände
            });
        });

        // Verarbeiten der Kanten
        for (const edge of edges) {
            const symbols = edge.label.split(/[,;\s]\s*/).map(symbol => symbol.trim());
            for (const symbol of symbols) {

                if (!alphabet.includes(symbol)) {
                    console.error(`Ungültiges Symbol '${symbol}' in Kante '${edge.id}' gefunden.`);
                    alert(`Ungültiges Symbol '${symbol}' in Kante '${edge.id}' gefunden.`);
                    return false;
                }
                const key = `${edge.source}-${symbol}`;
                if (transitions.get(key) !== null) {
                    console.error(`Mehr als ein Übergang für das Symbol '${symbol}' beim Zustand '${edge.source}' definiert.`);
                    alert(`Mehr als ein Übergang für das Symbol '${symbol}' beim Zustand '${edge.source}' definiert.`);
                    return false;
                }
                transitions.set(key, edge.target); // Setzt den Zielzustand für den Übergang
            };
        }

        // Überprüfung auf Vollständigkeit des DFA
        let isComplete = true;
        transitions.forEach((targetState, key) => {
            if (isComplete && targetState === null && !implyTrashStates) {
                // Wenn implyTrashStates false ist und ein Übergang fehlt, ist der DFA nicht vollständig
                alert("DFA ist nicht vollständig. Es fehlt der Übergang:" + key);
                isComplete = false;

            }
        });

        if (!isComplete) {
            console.error("DFA ist nicht vollständig. Es fehlen Übergänge für mindestens ein Symbol in mindestens einem Zustand.");

            return false;
        }

        // Überprüfung der Erreichbarkeit aller Zustände naja... still to debug
        let visited = new Set();
        let queue = [startStateId];
        while (queue.length > 0) {
            const currentState = queue.shift();
            if (!visited.has(currentState)) {
                visited.add(currentState);
                alphabet.forEach(symbol => {
                    const key = `${currentState}-${symbol}`;
                    const targetState = transitions.get(key);
                    if (targetState && !visited.has(targetState)) {
                        queue.push(targetState);
                    }
                });
            }
        }

        if (visited.size !== nodes.length) {
            console.error("Nicht alle Zustände sind erreichbar.");
            return false;
        }

        return true; // Der Automat ist ein vollständiger DFA
    }


    /**
     * Erstmal die partitionierung mit einem einzigen Symbol
     * @param partitions
     * @param edges
     * @param selectedEdge
     * @returns {{partitions: *[], changed: boolean}}
     */
/*


    function partitionDFAWithEdge(partitions, edges, selectedEdge,selectedSymbol) {

        let newPartitions = [];
        let changed = false;
        // Finde das Übergangssymbol der ausgewählten Kante
        //const selectedSymbol = selectedEdge.label;

        partitions.forEach(partition => {
            let targetPartitionMap = new Map();

            partition.forEach(node => {
                // Prüfe, ob der aktuelle Knoten der Quellknoten der ausgewählten Kante ist
                    const target = findTargetState(node, selectedSymbol, edges);

                    if (target !== null) { // behandle keine Müllzustände
                        const targetPartition = findPartitionForState(target, partitions);
                        if (targetPartition) {
                            let nodes = targetPartitionMap.get(targetPartition) || [];
                            nodes.push(node);
                            targetPartitionMap.set(targetPartition, nodes);
                        }
                    } else {
                        // Behandle Knoten ohne gültigen Übergang für das Symbol als müll separat
                        let nodes = targetPartitionMap.get(null) || [];
                        nodes.push(node);
                        targetPartitionMap.set(null, nodes);
                    }

            });

            // Erstelle neue Partitionen basierend auf der Gruppierung
            targetPartitionMap.forEach((nodes, _) => {
                if (nodes.length < partition.length) {
                    changed = true; // Die Partition wurde geändert
                }
                newPartitions.push(nodes);


            });
        });

        // Gib die neuen Partitionen und das Änderungsflag zurück appende die History
        setPartitionsHistory(prevHistory => {
            //hatten wir das Symbol schon?
            const symbolExists = prevHistory.some(entry => entry.symbol === selectedSymbol);
            if (!symbolExists) {
                return [...prevHistory, { symbol: selectedSymbol, partitions: newPartitions }];
            }
            return prevHistory; // Keine Änderung, wenn Symbol bereits vorhanden
        });
         setPartitions(newPartitions);

    }
*/

    function partitionDFAWithEdge(partitions, edges, selectedEdge, selectedSymbol) {
        let newPartitions = [];
        let changed = false;
        let changes = []; // Für die genauen Veränderungen, Objet wird in der renderHistory verwendet

        // Finde die Partition, die den Source-Knoten des ausgewählten Edge enthält
        const sourcePartition = partitions.find(partition =>
            partition.some(node => node.id === selectedEdge.source)
        );

        if (!sourcePartition) {
            // Falls die Source-Partition nicht gefunden wird, gib die ursprünglichen Partitionen zurück
            //better safe than sorry
            return { partitions, changed: false };
        }

        let targetPartitionMap = new Map();

        // Überprüfe nur die Partition, die die Source des ausgewählten Edge enthält für symbol
        sourcePartition.forEach(node => {
            const target = findTargetState(node, selectedSymbol, edges);

            if (target !== null) { // Ignoriere Müllzustände
                const targetPartition = findPartitionForState(target, partitions);
                if (targetPartition) {
                    let nodes = targetPartitionMap.get(targetPartition) || [];
                    nodes.push(node);
                    targetPartitionMap.set(targetPartition, nodes);
                }
            } else {
                // Behandle Knoten ohne gültigen Übergang für das Symbol separat
                let nodes = targetPartitionMap.get(null) || [];
                nodes.push(node);
                targetPartitionMap.set(null, nodes);
            }
        });

        // Erstelle neue Partitionen basierend auf der Gruppierung setze änderungsflag
        targetPartitionMap.forEach((nodes, targetPartition) => {
            if (nodes.length < sourcePartition.length) {
                changed = true;
                changes.push({
                    group: nodes,
                    targetPartition: targetPartition || 'null',
                    sourcePartition: sourcePartition.map(node => node.id)
                });
            }
            newPartitions.push(nodes);
        });

        // Füge die unveränderten Partitionen hinzu
        partitions.forEach(partition => {
            if (partition !== sourcePartition) {
                newPartitions.push(partition);
            }
        });

        // Appenden an die History
        if(partitionsHistory.length > 0){
            setPartitionsHistory(prevHistory => [
                ...prevHistory,
                { symbol: selectedSymbol, partitions: newPartitions, changed, changes }
            ]);
        }else{
            setPartitionsHistory(prevHistory => [
                ...prevHistory,
                { symbol: 'Start', partitions: partitions, changed: false },
                { symbol: selectedSymbol, partitions: newPartitions, changed, changes }
            ]);
        }

        // Gib die neuen Partitionen und das Änderungsflag zurück
        setPartitions(newPartitions);
        return { partitions: newPartitions, changed };
    }



    /**
     * Aktualisieren des aktuell akzeptiereten Alphabets
     * @param newAlphabet
     */
    const [inputAlphabet, setInputAlphabet] = useState(alphabet.join(', '));
    const handleAlphabetInput = (e) => {
        setInputAlphabet(e.target.value);
        updateAlphabet(e.target.value);
    }
    /**
     * Inputbox und alphabet stimmen immer überein
     * @param inputValue
     */
    const updateAlphabet = (inputValue) => {
        const newAlphabet = inputValue.split(/[;,]\s*|\s+/).map(symbol => symbol.trim()).filter((symbol, index, array) => array.indexOf(symbol) === index);
        setAlphabet(newAlphabet);
    };

    /**
     * Speichern der Konfiguration
     */

    const saveConfiguration = () => {
        const configuration = {
            nodes: nodes,
            edges: edges,
            alphabet: alphabet
        };
        localStorage.setItem('automatonConfiguration', JSON.stringify(configuration));
        alert("Automat wird gespeichert!");
    };

    /**
     *  Laden der Konfiguration
     */

    const loadConfiguration = () => {
        const configuration = JSON.parse(localStorage.getItem('automatonConfiguration'));
        if (configuration) {
            setNodes(configuration.nodes);
            setEdges(configuration.edges);
            setAlphabet(configuration.alphabet);
            alert("Gespeicherter Automat wird geladen!");
        } else {
            alert("Keine gespeicherte Konfiguration gefunden.");
        }
    };

    /**
     * neue partitioneung erzeugen
     */
    const [triggerCalculation, setTriggerCalculation] = useState(false);


    const handlePartitionerClick = () => {
        setTriggerCalculation(true);  // Dies löst die automatische Berechnung aus und rendert erst mit Abschluss
    };

    /**
     * Button zum Neuladen der Website
     */
    const resetPage = () =>{
        window.location.reload();
    }

    /**
     * Anzeige Rendering der neuen Partitionen mit Übergangssysmbol
     * @param historyEntry
     * @returns {JSX.Element}
     */
    const renderPartitionWithSymbol = (historyEntry) => {
        if (!historyEntry || !historyEntry.partitions) {
            return <div>Partitionsgeschichte ist nicht verfügbar.</div>;
        }

        return (
            <div className="partition-with-symbol">
                {historyEntry.partitions.map((partition, partitionIndex) => (
                    <span key={partitionIndex}>
            {'{' + partition.map(node => node.id).join(", ") + '}'}
                        {partitionIndex < historyEntry.partitions.length - 1 ? " | " : ""}
        </span>
                ))}

            </div>

        );
    };



    /** Hilfsfunktion zum Prüfen ob der Automat schon minimal is, erzeugt ergebnis von automaticher berechnung für
     * Vergleich mit aktuell erzeugtem Automaten
     *
     */
    function refinePartitions(partitions, edges) {
        let currentPartitions = partitions;


        alphabet.forEach(symbol => {
            let newPartitions = [];

            currentPartitions.forEach(partition => {
                let partitionMap = new Map();

                // Durchlaufe jeden Zustand in der aktuellen Partition
                partition.forEach(node => {
                    // Finde den Zielzustand für den aktuellen Knoten und das spezifische Symbol
                    const target = findTargetState(node, symbol, edges);

                    // Finde die Partition, zu der der Zielzustand gehört
                    const targetPartition = target ? findPartitionForState(target, currentPartitions) : null;

                    // Schlüssel basierend auf dem Zielzustand und der Partition, Müllzustände sind wichtig und bekommen eigenen Key
                    let key = targetPartition ? currentPartitions.indexOf(targetPartition).toString() : 'none';

                    // Gruppiere Knoten basierend auf ihrem Zielzustand
                    if (!partitionMap.has(key)) {
                        partitionMap.set(key, []);
                    }
                    partitionMap.get(key).push(node);
                });

                // Füge die neu gebildeten Partitionen der Liste der neuen Partitionen hinzu
                partitionMap.forEach(group => {
                    if (group.length > 0) {
                        newPartitions.push(group);
                    }
                });
            });

            // Aktualisiere die aktuellen Partitionen für das nächste Symbol
            currentPartitions = newPartitions;
        });

        // Loope jede Partition
        return currentPartitions;
    }



    /** Prüft ob zwei Partitionen identisch sind
     *
     * @param partitions1
     * @param partitions2
     * @returns {boolean}
     */
    function comparePartitions(partitions1, partitions2) {
        if (partitions1.length !== partitions2.length) {
            return false;
        }

        const sortedPartitions1 = partitions1.map(partition =>
            partition.map(node => node.id).sort()
        ).sort((a, b) => a[0].localeCompare(b[0]));

        const sortedPartitions2 = partitions2.map(partition =>
            partition.map(node => node.id).sort()
        ).sort((a, b) => a[0].localeCompare(b[0]));

        for (let i = 0; i < sortedPartitions1.length; i++) {
            if (sortedPartitions1[i].join() !== sortedPartitions2[i].join()) {
                return false;
            }
        }

        return true;
    }


    const checkIfMinimizedDFA = () => {
        let minimizedCheckPartitions = partitions; // Start mit den initialen Partitionen
            minimizedCheckPartitions = refinePartitions(partitions, edges);


        setIsDFAMinimized( comparePartitions(partitions, minimizedCheckPartitions));
    };


    /**
     * Kreation des Äquivalenzautomaten basierend auf den aktuellen Partitionen
     * @param partitions
     * @returns {{newEdges: *[], newNodes: *[]}}
     */
    useEffect(() => {
        createMinimizedGraph();
        setIsDFAMinimized(null);

    }, [partitions]); // Abhängigkeit von der existenz der Partitionen


    const createMinimizedGraph = () => {
        const newNodes = [];
        const newEdges = [];
        const partitionMap = {}; // Mapt die alten Knoten-IDs auf neue Knoten-IDs
        const edgeLabelsMap = {}; // Mapts Labels für Kanten zwischen Partitionen

        // Schritt 1: Neue Knoten erstellen
        partitions.forEach((partition, index) => {
            if (partition.length === 0) {
                //edge case wenn input= output und keine anderen Knoten verfügbar
                console.error("Leere Partition entdeckt, überspringe diese Partition.");
                return; //die partition wird übersprungen, da sie leer ist
            }

            const isOutput = partition.some(node => node?.data?.output);
            const isInput = partition.some(node => node?.data?.input);

            let style = {};
            if (isInput) {
                style.backgroundColor = '#a4d36b';
            }
            if (isOutput) {
                style.border = "3px solid black";
                style.borderStyle = "double";
            }
            if (isInput && isOutput) {
                // Kombiniertes styling für Knoten, die sowohl Input als auch Output sind
                    style.border = "3px solid black" ;
                    style.borderStyle= "double";
                    style.backgroundColor = '#a4d36b';
                }

            const newNode = {

                id: `P${index}`, // Eindeutige ID für den neuen Knoten
                data: { ...partition[0].data, label: "{" + partition.map(node => node.data.label).join(", ") +"}" },
                position: calculateAveragePosition(partition, nodes),
                targetPosition: 'left',
                sourcePosition: 'right',
                style: Object.keys(style).length > 0 ? style : undefined //entweder Style schon vorhanden, oder default node
            };

            newNodes.push(newNode);

            // Aktualisiere die Partitionen
            partition.forEach(node => {
                partitionMap[node.id] = newNode.id;
            });
        });

        // Schritt 2: Neue Kanten und deren Labels erstellen, einschließlich Selbstkanten
        edges.forEach(edge => {
            const sourcePartition = partitionMap[edge.source];
            const targetPartition = partitionMap[edge.target];

            // Generiere einen einzigartigen Schlüssel für jede Kantenverbindung zwischen Partitionen
            const edgeKey = `${sourcePartition}->${targetPartition}`;
            // Initialisiere das Label für die Kante, falls noch nicht geschehen
            if (!edgeLabelsMap[edgeKey]) {
                edgeLabelsMap[edgeKey] = { labels: new Set(), type: null };
            }


            const normalizedLabel = edge.label.replace(/,\s*/g, " "); // Ersetzt Kommas und darauf folgende Leerzeichen durch ein Leerzeichen
            normalizedLabel.split(" ").forEach(label => edgeLabelsMap[edgeKey].labels.add(label)); //keine dupletten


            //Kollisionskanten
            const reverseEdgeKey = `${targetPartition}->${sourcePartition}`;
            if (edgeLabelsMap[reverseEdgeKey]) {
                edgeLabelsMap[edgeKey].type = 'default'; // Setze den Typ auf custom für gegenläufige Kanten
                edgeLabelsMap[reverseEdgeKey].type = 'custom';
            }

            // Überprüfe, ob die Kante eine Selbstkante ist
            if (sourcePartition === targetPartition) {
                edgeLabelsMap[edgeKey].type = 'selfconnecting';
            }
        });

        //  neue Kanten basierend auf edgeLabelsMap, einschließlich Selbstkanten
        Object.keys(edgeLabelsMap).forEach((key, index) => {
            const [source, target] = key.split('->');
            // Konvertiere das Set von Labels zurück in einen String, getrennt durch Leerzeichen
            const labelsString = Array.from(edgeLabelsMap[key].labels).join(" ");
            const newEdge = {
                id: `e${index}`,
                source: source,
                target: target,
                label: labelsString,
                data: {label: labelsString},
                type: edgeLabelsMap[key].type || 'default'
            };
            newEdges.push(newEdge);
        });

        setfinalNodes(newNodes);
        setfinalEdges(newEdges);
    };

    const onNodeDrag = useCallback(
        (event, node) => {
            if (node.data.input === true) {
                const hiddenNodeId = `${node.id}-hidden`;
                setNodes((nds) =>
                    nds.map((n) => {
                        if (n.id === hiddenNodeId) {
                            return {
                                ...n,
                                position: {
                                    x: node.position.x - 50,
                                    y: node.position.y,
                                },
                            };
                        }
                        return n;
                    })
                );
            }
        },
        [setNodes]
    );


    /**
     * Automatische Berechnung der Positionen der Zustände des erzeugten Graphen
     * @param partition
     * @param originalNodes
     * @returns {{x: number, y: number}}
     */

    function calculateAveragePosition(partition, originalNodes) {
        const positions = partition.map(node => {
            const originalNode = originalNodes.find(n => n.id === node.id);
            if (!originalNode) {
                alert(`Knoten mit ID ${node.id} nicht gefunden.`);

            }
            else{

                return originalNode.position;
            }
        }).filter(pos => pos !== null); // Filtere ungültige Positionen heraus

        if (positions.length === 0) {
            console.error('Keine gültigen Positionen gefunden');
            return { x: 0, y: 0 }; // Setze eine Standardposition
        }

        const averagePosition = {
            x: positions.reduce((acc, pos) => acc + pos.x, 0) / positions.length,
            y: positions.reduce((acc, pos) => acc + pos.y, 0) / positions.length
        };
        return averagePosition;
    }

    /**
     * Erstelle die anzeige der knoten, für den unsichtbaren Knoten außerhalb jeglicher Logik
     * @param nodes
     * @param edges
     * @returns {{displayEdges: *[], displayNodes: *[]}}
     */
    const generateDisplayNodesAndEdges = (nodes, edges) => {
        const displayNodes = [...nodes];
        const displayEdges = [...edges];

        nodes.forEach(node => {
            if (node.data.input) {
                const hiddenNodeId = `${node.id}-hidden`;
                const hiddenEdgeId = `edge-${hiddenNodeId}-${node.id}`;

                // Überprüfe, ob der hiddenNode bereits existiert
                const hiddenNodeExists = displayNodes.some(n => n.id === hiddenNodeId);
                const hiddenEdgeExists = displayEdges.some(e => e.id === hiddenEdgeId);

                if (!hiddenNodeExists) {
                    const hiddenNode = {
                        id: hiddenNodeId,
                        data: { label: `${node.id}-hidden` },
                        position: { x: node.position.x - 50, y: node.position.y },
                        sourcePosition: 'right',
                        targetPosition: 'left',
                        style: { visibility: 'hidden' },
                        animated: false,
                        updateable: false,
                        connectable: false,
                    };
                    displayNodes.push(hiddenNode);
                }

                if (!hiddenEdgeExists) {
                    const hiddenEdge = {
                        id: hiddenEdgeId,
                        source: hiddenNodeId,
                        target: node.id,
                        label: '',
                        markerEnd: { type: MarkerType.ArrowClosed },
                        selectable: false,
                        type: 'smoothstep',
                        animated: false,
                    };
                    displayEdges.push(hiddenEdge);
                }
            }
        });

        return { displayNodes, displayEdges };
    };

    /**
     * Zwischenspeichern der AnzeigeKnoten in useMemo
     */
    const { displayNodes, displayEdges } = useMemo(() => generateDisplayNodesAndEdges(nodes, edges), [nodes, edges]);


    /**
     *  dynamisches Stylen der Edges als enhance edges mit  hover-based styling
     */


    const getEnhancedEdges = useCallback(() => {
        return finaledges.map(edge => {

            const sourceNode = finalnodes.find(node => node.id === edge.source);

            const shouldHighlight = sourceNode && sourceNode.data.label.includes(highlightedPartition) && edge.label.includes(highlightHoverSymbol)

            return {
                ...edge,
                style: {
                    ...edge.style,
                    strokeWidth: shouldHighlight ? 2 : 1,
                    stroke: shouldHighlight ? 'red' : '#b1b1b7'

                },
                markerEnd: { type: MarkerType.ArrowClosed },
            };
        });
    }, [finaledges, highlightHoverSymbol, highlightedPartition, partitions]);


    return (
      <>
     <div className="toptext" ref={topTextRef} >D F A ---  M I N I M I E R E R ! </div>

          <div className="App">
              <div className="Kontrollcontainer" ref={kontrollContainerRef}>
                  <h3 className ="aktuelleKonfiguration"> Konfiguration des Automaten:</h3>

                  <div className="alphabet">{`Σ = {${alphabet.join(', ')}}`}</div>
                  <div className="zustände">
                      {`Z = {${nodes.filter(node => node.style?.visibility !== 'hidden').map((node) => node.data.label).join(",  ")}}`}
                  </div>
                  <div className="zustände">
                      {`E = {${nodes.filter(node => node.style?.visibility !== 'hidden' && node.data.output).map((node) => node.data.label).join(", ")}}`}
                  </div>

                  <NodeLabelList nodes={nodes.filter(node => node.style?.visibility !== 'hidden')} edges = {edges}/>

                  <div className="examplebuttons">
                      <div className="dropdown">
                          <button className="dropbtn">Beispiele</button>
                          <div className="dropdown-content">
                              <button onClick={miniField}>Reset</button>
                              <button onClick={resetPage}>Beispiel 1</button>
                              <button onClick={plainField}>Beispiel 2</button>
                              <button onClick={exampleField3}>Beispiel 3</button>
                          </div>
                      </div>
                      <div className="dropdown">
                          <button className="dropbtn">Speicher</button>
                          <div className="dropdown-content">
                              <div className="controls">
                                  <button onClick={saveConfiguration}>Automat speichern</button>
                                  <button onClick={loadConfiguration}>Automat laden</button>
                              </div>
                          </div>
                      </div>


                  </div>

                      <label className="implyTrashStates" >
                          Müllzustand implizieren: <input type="checkbox" checked={implyTrashStates} onChange={toggleImplyTrashStates} />
                      </label>



                  <div className="DFAContainer">
                      <button onClick={checkIsDFA}>Ist der konfigurierte Automat ein DFA?</button>
                      <div className={`DFAAnzeige ${isDfaResult !== null ? (isDfaResult ? 'true' : 'false') : ''}`}>
                          {isDfaResult !== null && (<div>{isDfaResult ? 'Ja' : 'Nein'}</div>)}
                      </div>
                      {isDfaResult === true && (
                          <>
                              <button onClick={checkIfMinimizedDFA}>Ist der erzeugte Automat minimal?</button>
                              <div className={`IfMinimizedDFA ${isDFAMinimized !== null ? (isDFAMinimized ? 'true' : 'false') : ''}`}>
                                  {isDFAMinimized !== null && (<div>{isDFAMinimized ? 'Ja' : 'Nein'}</div>)}
                              </div>
                          </>
                      )}
                  </div>
                  <div>


                      {
                          isDFAMinimized === true && (<button onClick={() => toggleMiniKonfigVisibility()}>
                              {miniKonfigVisibility ? 'Details ausblenden' : 'Details einblenden'}
                          </button>)
                      }
                  {
                      miniKonfigVisibility === true && isDFAMinimized === true &&
                      (
                          <div className="miniKonfiguration">
                              <h3 className ="aktuelleKonfiguration"> Konfiguration des Minimalautomaten:</h3>
                          <div className="zustände">{`Z = {${finalnodes.map((node) => node.data.label).join(",  ")}}`}</div>
                          <div className="zustände">
                              {`E = {${finalnodes.filter((node) => node.data.output).map((node) => node.data.label).join(", ")}}`}
                          </div>
                          <NodeLabelList nodes={finalnodes} edges={finaledges}/>

                          </div>)
                  }


                </div>
              </div>
              <div className="reactFlowsContainer" style={{ height: '140vh', width: '90%', marginBottom: '20px' }}>

        <ReactFlow
            ref={ref}
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDrag={onNodeDrag}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            edgeTypes={EdgeTypes}
            nodeTypes={NodeTypes}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeContextMenu = {onNodeContextMenu}
            onEdgeContextMenu = {onEdgeContextMenu}
            fitView //Für den automatischen Fullscreen
        >
          <Controls />

            <MiniMap pannable
            nodes={nodes.filter(node => !node.id.includes('hidden'))}/>

            <Background variant="dots" gap={15} size={1} />
            {menu && <NodeContextMenu onClick={onPaneClick} {...menu} />}
            {edgemenu && <EdgeContextMenu onClick={onPaneClick} {...edgemenu} />}
        </ReactFlow>

                  {isDFAMinimized !== true && (<Sidebar />)}
                  <div className= "bottomdiv" style={{ display: 'flex', flexDirection: 'row' }}>
                  <div className="finalFlowrenderer" style={{ height: '80vh', width: '95%' }}>
                  {partitions && isDfaResult && (
                      <>

                      <h2 className="header">
                          {isDFAMinimized ? (
                              <>Erzeugter minimaler Automat:</>
                          ) : (
                              <>Erzeugter Automat:</>
                          )}
                      </h2>

                  <ReactFlow
                      ref={refFinal}
                      nodes={finalnodes.filter(node => !node.id.includes('hidden'))}
                      edges={getEnhancedEdges()}
                      onNodesChange={onfinalNodesChange}
                      onEdgesChange={onfinalEdgesChange}
                      edgeTypes={EdgeTypes}
                      nodeTypes={NodeTypes}
                      fitView
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={false}
                      zoomOnScroll={false}
                      zoomOnDoubleClick={false}
                  >
                      <Controls
                          showZoom = {false}
                          showInteractive ={false}/>
                  </ReactFlow>
                      </>

                  )}

                 </div>

                <div className= "partitiondiv" style={{height:'60vh', width:'85%', display: 'flex', flexDirection: 'column' , padding: '15px'}}>
                    {partitions && isDfaResult &&(
                        <>
                    <Partitioner
                        isDfaResult={isDfaResult}
                        nodes={nodes.filter(node => !node.id.includes('hidden'))}
                        edges={edges}
                        alphabet={alphabet}
                        partitions={initialPartition(nodes.filter(node => !node.id.includes('hidden')))}
                        setPartitions={setPartitions}
                        triggerCalculation={triggerCalculation}
                        setTriggerCalculation={setTriggerCalculation}
                        partitionsHistory={partitionsHistory}
                        setPartitionsHistory={setPartitionsHistory}
                        setIsDFAMinimized={setIsDFAMinimized}
                    />

                    <div className="partition-history">
                        {partitionsHistory.map((historyEntry, index) => (
                            <div key={index} className="partitionHistoryColumn">
                                {index > 0 && (
                                    <div className="step-number">
                                        {index}. {historyEntry.changed ? ` Aufteilung` : ` Überprüfung`} mit Symbol <strong>{historyEntry.symbol}</strong>:
                                    </div>
                                )}
                                <br/>
                                {index === 0 && <><div className="step-number">Aufteilung in Zustände & Endzustände: </div> <br/> </>}
                                {renderPartitionWithSymbol(historyEntry)}
                                {historyEntry.changed && (
                                    <div>
                                        <button onClick={() => toggleDetailsVisibility(index)}>
                                            {detailsVisibility[index] ? 'Details ausblenden' : 'Details einblenden'}
                                        </button>
                                        {detailsVisibility[index] && (
                                            <div>
                                                <ul>
                                                    {historyEntry.changes.map((change, changeIndex) => {
                                                        const groupIds = change.group.map(node => node.id).join(', ');
                                                        const targetPartitionIds = Array.isArray(change.targetPartition) ? change.targetPartition.map(node => node.id).join(', ') : 'Müllzustand';
                                                        const verb = change.group.length > 1 ? 'gehen' : 'geht';
                                                        const nomen = change.group.length > 1 ? 'Zustände' : 'Zustand';

                                                        return (
                                                            <li key={changeIndex}>
                                                                {nomen} {`{${groupIds}}`} {verb} mit "{historyEntry.symbol}" in Klasse {`{${targetPartitionIds}}`} über.
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div style={{ height: '15px' }}></div>
                            </div>
                        ))}
                    </div>
                </>
                    )}
                </div>
              </div>

            </div>
          </div>

          <footer className="footer">
              <p><strong>&copy; 2024 Henning Köpf</strong> - <strong>Kontakt:</strong> ************@gmx.de</p>
          </footer>


          </>

  );
}
export default App;




