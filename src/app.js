import React, { useEffect, useState } from 'react';
import { ForceGraph3D } from 'react-force-graph';
import { marked } from 'marked';
import * as THREE from 'three';
import './main.css'


const makeTextSprite = (message) => {
    const fontface = 'Arial';
    const fontsize = 12;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${fontsize}px ${fontface}`;

    // Get text metrics
    const metrics = context.measureText(message);
    const textWidth = metrics.width;

    // Set canvas dimensions dynamically
    const padding = 10; // Extra padding around the text
    canvas.width = textWidth + padding;
    canvas.height = fontsize + padding;

    // Re-apply text to fill canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${fontsize}px ${fontface}`;
    context.fillStyle = 'rgba(255, 255, 255, 1.0)';
    context.fillText(message, padding / 2, fontsize + padding / 2);

    // Create texture
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });

    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(canvas.width / 10, canvas.height / 10, 1);
    return sprite;
};

//find links for each node 
const parseNote = (note) => {
    const { title, content } = note;
    const links = content.match(/\[\[([^\]]+)\]\]/g) || [];
    return {
        title,
        links: links.map(link => link.slice(2, -2))
    };
};

const Overlay = ({ node, closeOverlay, setSelectedNode, nodes }) => {
    useEffect(() => {
        // Find all custom link elements after the component is rendered
        const customLinks = document.querySelectorAll('.custom-link');

        // Add click event listeners to these elements
        customLinks.forEach((linkElement) => {
            linkElement.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                // Find the node corresponding to this custom link
                const targetNode = nodes.find((n) => n.name === linkElement.textContent);
                if (targetNode) {
                    // Set the node as the selected node to update the overlay content
                    setSelectedNode(targetNode);
                }
            });
        });

        // Clean up event listeners when the component is unmounted
        return () => {
            customLinks.forEach((linkElement) => {
                linkElement.removeEventListener('click', null);
            });
        };
    }, [nodes, setSelectedNode]);

    // Parse the content with markdown first
    const rawHtml = marked(node.content || '');

    // Replace [[...]] with HTML anchor tags
    const enhancedHtml = rawHtml.replace(/\[\[([^\]]+)\]\]/g, '<a href="#" class="custom-link">$1</a>');

    return (
        <div className="overlay" onClick={closeOverlay}>
            <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
                <h1>{node.name}</h1>
                <div dangerouslySetInnerHTML={{ __html: enhancedHtml }}></div>
            </div>
        </div>
    );
};


const App = () => {
    const closeOverlay = () => setSelectedNode(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [notes, setNotes] = useState([]);

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

    const myGraph = {
        nodes,
        links
    };

    return (
        <div onClick={closeOverlay}>
            <ForceGraph3D
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
                    sprite.position.set(0, -0.6, 0);
                    group.add(sprite);

                    return group;
                }}
                onNodeClick={node => {
                    console.log("Clicked node:", node);
                    setSelectedNode(node);
                }}
            />
            {selectedNode && <Overlay node={selectedNode} closeOverlay={closeOverlay} setSelectedNode={setSelectedNode} nodes={nodes} />}
        </div>

    );
};

export default App;
