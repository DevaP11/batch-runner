
#!/bin/bash

# Setup python virtual environment
python3 -m venv batch-runner-env

# Use that python virtual environment
source batch-runner-env/bin/activate

# Get the current working directory
current_dir=$(pwd)

# Open the first process in a new Terminal window and execute from the backend directory
osascript -e 'tell application "Terminal" to do script "cd '$current_dir' && node main.js"'

# Open the second process in another new Terminal window and execute from the frontend directory
osascript -e 'tell application "Terminal" to do script "cd '$current_dir' && streamlit run streamlit_app.py"'
