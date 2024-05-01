# my-3d-graph

# Knowledge Navigator Web Application

## Overview

This Knowledge Navigator is a React-based web application designed to interact with a Chatbot API and render content with interconnected nodes. Users can search for topics using natural language queries. The results are returned from a backend API, and relevant nodes are displayed within the web interface. Nodes are interconnected using a wikilink-style system, allowing users to navigate through related content.
This includes my personal mindmap initially created on obsidian. Includes my personal fav topics for learning including quantum physics, space time, black hole theories, metaphysics connections. 

## Features

- Natural language search and question interface
- Dynamic content rendering using 3d-react-graph
- Interactive node navigation through wikilink-style links
- Custom-built overlay components to display document information

## Tech Stack

- **Frontend:** React.js
- **Markdown Parsing:** Marked.js 
- **Styling:** CSS
- **Backend API:** Python - CORS
- **Database:** local files from obsidian

## Prerequisites

Before running this application, you need to have the following installed:

- Node.js (v14.x or later)
- npm (v6.x or later) or Yarn (v1.22.x or later)
- A running instance of the backend server that provides the API endpoints for the chatbot and node data.

