from pymongo import MongoClient
import pandas as pd

# MongoDB connection
mongo_uri = "mongodb+srv://gtakpsisoftware:brznOWH0oPA9fT5N@gtakpsi.bf6r1.mongodb.net/"
client = MongoClient(mongo_uri)

# Access database and collection
db = client["rush-app"]
rushee_collection = db["rushees"]

# Retrieve data from MongoDB
rushees = rushee_collection.find()

# Prepare data for DataFrame
data = []
for rushee in rushees:
    data.append({
        'first_name': rushee.get('first_name', ''),
        'last_name': rushee.get('last_name', ''),
        'housing': rushee.get('housing', ''),
        'phone_number': rushee.get('phone_number', ''),
        'email': rushee.get('email', ''),
        'gtid': rushee.get('gtid', ''),
        'major': rushee.get('major', ''),
        'class': rushee.get('class', ''),
        'flex_window': 'Yes' if rushee.get('flex_window', False) else 'No'
    })

# Create a DataFrame
df = pd.DataFrame(data, columns=[
    'first_name',
    'last_name',
    'housing',
    'phone_number',
    'email',
    'gtid',
    'major',
    'class',
    'flex_window'
])

# Export to Excel (requires `openpyxl` package)
df.to_excel("rushees.xlsx", index=False)
print("Data successfully written to rushees.xlsx")
