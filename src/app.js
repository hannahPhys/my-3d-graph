import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { ForceGraph3D } from 'react-force-graph'
import { marked } from 'marked'
import * as THREE from 'three'
import './main.css'
import { makeTextSprite } from './utilities/makeTextSprite'

//find links for each node 
const parseNote = (note) => {
    const { title, content } = note;
    const links = content.match(/\[\[([^\]]+)\]\]/g) || [];
    return {
        title,
        links: links.map(link => link.slice(2, -2))
    };
};

const SideBar = React.memo(({ APIResponse }) => {
    return (
        <div className="sidebar">
            <div className="diagnostics">
                <div className="time">Processing Time: {parseFloat(APIResponse.diagnostics.processing_time_sec).toFixed(2)}s</div>
                <div className="version">Version: {APIResponse.diagnostics.llm_version}</div>
            </div>
            <div className="response">
                {APIResponse.response}
            </div>
        </div>
    );
});

const Overlay = React.memo(({ node, setSelectedNode, nodes }) => {
    // This will run whenever node changes and it will update the links
    useEffect(() => {
        // Ensure that the DOM has been updated
        setTimeout(() => {
            const customLinks = document.querySelectorAll('.custom-link');

            customLinks.forEach(link => {
                const nodeName = link.getAttribute('data-node-name');
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    const targetNode = nodes.find(n => n.name === nodeName);
                    if (targetNode) {
                        setSelectedNode(targetNode);
                    }
                });
            });
        }, 0);

        // Cleanup the event listeners when the component unmounts or updates
        return () => {
            const customLinks = document.querySelectorAll('.custom-link');
            customLinks.forEach(link => {
                link.removeEventListener('click', null);
            });
        };
    }, [node, setSelectedNode, nodes]);

    // Parse the content with markdown first
    const rawHtml = marked(node.content || '');

    // Replace [[...]] with HTML anchor tags that include data attributes for the node name
    const enhancedHtml = rawHtml.replace(/\[\[([^\]]+)\]\]/g, (_, nodeName) => `<a href="#" class="custom-link" data-node-name="${nodeName}">${nodeName}</a>`);

    return (
        <div className="overlay" onClick={(e) => e.stopPropagation()}>
            <div className="overlay-card">
                <h1>{node.name}</h1>
                <div dangerouslySetInnerHTML={{ __html: enhancedHtml }} />
            </div>
        </div>
    );
});

const App = ({ APIResponse }) => {
    const [notes, setNotes] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const myGraphRef = useRef();

    // pull documents from documents server
    useEffect(() => {
        fetch('http://localhost:3001/api/notes')
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setNotes(data);
                }
            })
            .catch(error => {
                console.error('Error fetching notes:', error);
            });
    }, []);

    // convert each document into a node with [[ ]] being the link between nodes
    // memoized to prevent unnecessary useEffect invocations
    const { nodes, links } = useMemo(() => {
        let counter = 1;
        const nodes = notes.map(note => ({ id: counter++, name: note.title, content: marked(note.content) }));
        const links = [];

        notes.forEach(note => {
            const { title, links: linkedNotes } = parseNote(note);
            linkedNotes.forEach(linkedNote => {
                const sourceNode = nodes.find(node => node.name === title);
                const targetNode = nodes.find(node => node.name === linkedNote);
                if (sourceNode && targetNode) {
                    links.push({ source: sourceNode.id, target: targetNode.id });
                }
            });
        });

        return { nodes, links };
    }, [notes]);

    const myGraph = {
        nodes,
        links
    };

    const handleClick = useCallback((node) => {
        // Aim at node from outside it
        //needs to be from handle click otherwise cant find coords
        //setSelectedNode(node);
        //debugger;

        const distance = 60;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        myGraphRef.current.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
            node, // lookAt target ({ x, y, z })
            3000  // ms transition duration
        )
    }, []);


    //finding the most related item to do with search term
    useEffect(() => {
        if (APIResponse) {
            const matchingNode = nodes.find(node => node.name.toLowerCase() === APIResponse.file_name.toLowerCase());
            if (matchingNode) {
                setSelectedNode(matchingNode);
            }
        }
    }, [APIResponse]);

    return (
        <div className="graph-container" >
            <ForceGraph3D
                ref={myGraphRef}
                graphData={myGraph}
                nodeLabel="name"
                nodeAutoColorBy="id"
                linkDirectionalArrowLength={0}
                linkDirectionalArrowRelPos={1}
                nodeRelSize={1}
                gravity={-500}
                linkWidth={0.5}
                nodeThreeObject={(node) => {

                    // create group
                    const group = new THREE.Object3D();

                    // create sphere
                    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
                    const material = new THREE.MeshBasicMaterial({ color: node.color });
                    const sphere = new THREE.Mesh(geometry, material);
                    group.add(sphere);

                    // create text sprite
                    const sprite = makeTextSprite(node.name);
                    sprite.position.set(0, -0.8, 0);
                    group.add(sprite);

                    return group;
                }}
                onNodeClick={node => {
                    console.log("Clicked node:", node);
                    setSelectedNode(node);
                }}
            />
            {selectedNode && <Overlay node={selectedNode} setSelectedNode={setSelectedNode} nodes={nodes} />}

            {APIResponse && <SideBar APIResponse={APIResponse} />}

        </div>

    );
};

export default App;
