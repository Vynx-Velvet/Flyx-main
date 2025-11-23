
with open(r'c:\Users\Nicks\Desktop\Flyx-main\scripts\reverse-engineering\prorcp-unpacked.js', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Content length: {len(content)}")
index = content.find('decode')
while index != -1:
    print(f"Found 'decode' at {index}")
    # Print context
    start = max(0, index - 50)
    end = min(len(content), index + 50)
    print(f"Context: ...{content[start:end]}...")
    index = content.find('decode', index + 1)
