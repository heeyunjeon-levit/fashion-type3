import pandas as pd

# Read the Excel file
df = pd.read_excel('/Users/levit/Desktop/file+phonenumber.xlsx')

print("Excel file structure:")
print(df.head(20))
print("\nColumn names:")
print(df.columns.tolist())
print(f"\nTotal rows: {len(df)}")
print("\nData types:")
print(df.dtypes)

