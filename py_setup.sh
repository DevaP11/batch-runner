
#!/bin/bash

# Setup python virtual environment
python3 -m venv batch-runner-env

# Use that python virtual environment
source batch-runner-env/bin/activate

# Install all Packages
pip3 install -r requirements.txt

# Run Streamlit Applications
streamlit run streamlit_app.py
