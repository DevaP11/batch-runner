import datetime
import json
import time
import streamlit as st
import sqlite3
import pandas as pd

class Data_view:
    # Constructor with default value for color
    def __init__(self, record_id, batch_id, last_checkpoint_name, last_checkpoint_status):
        self.record_id = record_id
        self.batch_id = batch_id
        self.last_checkpoint_name = last_checkpoint_name
        self.last_checkpoint_status = last_checkpoint_status

    # Method to display car details
    def show_details(self):
        return {
            "record_id": self.record_id,
            "batch_id": self.batch_id,
            "last_checkpoint_name": self.last_checkpoint_name,
            "last_checkpoint_status": self.last_checkpoint_status
        }

def read_data_db ():
    list_view = []

    connection_obj = sqlite3.connect('core.db')
    # cursor object
    cursor_obj = connection_obj.cursor()

    cursor_obj.execute("SELECT batchId, records FROM BatchTracker")
    batches = cursor_obj.fetchall()


    for batch in batches:
        batch_id = batch[0]
        records_in_batch = batch[1]
        records = json.loads(records_in_batch) if records_in_batch else[]

        for record_id in records:
            cursor_obj.execute("SELECT * FROM Checkpointer WHERE recordId = ?",  (record_id,))
            checkpoints = cursor_obj.fetchall()
            if not checkpoints:
                continue

            last_checkpoint = sorted(
                checkpoints,
                key=lambda x: datetime.datetime.strptime(x[3], '%Y-%m-%d %H:%M:%S'),
                reverse=True
            )[0]
            last_checkpoint_name = last_checkpoint[1]
            last_checkpoint_status = last_checkpoint[2]
            data_view = Data_view(record_id, batch_id, last_checkpoint_name, last_checkpoint_status)
            list_view.append(data_view.show_details())

    df = pd.DataFrame(list_view)

    return df

st.subheader("Records")
data_placeholder = st.empty()
while True:
    # Fetch the latest data from the database
    data_frame = ''
    try:
        data_frame = read_data_db()
    except:
        print('Data Fetch Failed')
        continue

    data_placeholder.dataframe(data_frame, width=1500)

    # Wait for a few seconds before rerunning the query
    time.sleep(3)  # Poll
