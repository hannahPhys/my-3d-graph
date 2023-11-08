
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin 

from llama_index import SimpleDirectoryReader, LLMPredictor, PromptHelper, VectorStoreIndex, get_response_synthesizer
from llama_index.retrievers import VectorIndexRetriever
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.indices.postprocessor import SimilarityPostprocessor

from langchain.chat_models import ChatOpenAI
import sys
import os
import time
from dotenv import load_dotenv
load_dotenv()  

import openai
api_key = os.getenv('OPENAI_API_KEY')
openai.api_key = api_key

app = Flask(__name__)
CORS(app)

def construct_index(directory_path):
    max_input_size = 4096
    num_outputs = 512
    chunk_overlap_ratio = 0.1
    chunk_size_limit = 600

    prompt_helper = PromptHelper(max_input_size, num_outputs, chunk_overlap_ratio, chunk_size_limit=chunk_size_limit)

    llm_predictor = LLMPredictor(llm=ChatOpenAI(temperature=0.3, model_name="gpt-4", max_tokens=num_outputs))

    documents = SimpleDirectoryReader(directory_path, filename_as_id=True).load_data()

    index = VectorStoreIndex(documents, llm_predictor=llm_predictor, prompt_helper=prompt_helper)
    index.storage_context.persist(persist_dir='index.json')
    print('built index using documents ' + directory_path )

    return index

index = construct_index("./backend/docs")

def chatbot(input_text):
    retriever = VectorIndexRetriever(
        index=index,
        similarity_top_k=10,
    )

    # configure response synthesizer
    response_synthesizer = get_response_synthesizer()

    # assemble query engine
    query_engine = RetrieverQueryEngine(
        retriever=retriever,
        response_synthesizer=response_synthesizer,
        node_postprocessors=[
            SimilarityPostprocessor(similarity_cutoff=0.7)
        ]
    )
    print('query engine ', input_text )
    response = query_engine.query(input_text)
    print('response', response)
    print(response.source_nodes[0])
    return response


# Create an API endpoint for the chatbot function
@app.route('/chatbot', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['http://localhost:3000'], methods=['POST', 'OPTIONS'], allow_headers=['Content-Type'], supports_credentials=True)
def chatbot_endpoint():
    start_time = time.time()
    input_text = request.json['input_text']
    response = chatbot(input_text)
    processing_time = time.time() - start_time  # Calculate processing time

    full_document_id = response.source_nodes[0].node.id_
    # Extract just the filename without the part number 
    file_name = full_document_id.split('/').pop().split('_')[0].split('.')[0]
   # Diagnostic information
    diagnostics = {
        "processing_time_sec": processing_time,
        "llm_version": "gpt-4",  # or dynamically fetch this if your model might change
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
    }

    response_data = {
        'file_name': file_name,
        'input_text': input_text,
        'response': response.response,
        'diagnostics': diagnostics
    }

    return jsonify(response_data)


# Start the Flask application
if __name__ == '__main__':
    app.run(port=5000, debug=True)  # Choose a port that is available
