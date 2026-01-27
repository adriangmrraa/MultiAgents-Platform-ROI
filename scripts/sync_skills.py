import glob
import os

def generate_table():
    lines = []
    lines.append('| Skill Name | Trigger | Descripción |')
    lines.append('| :--- | :--- | :--- |')
    
    files = glob.glob('.agent/skills/*/SKILL.md')
    # Sort files to ensure deterministic order (alphabetical by folder name or file path)
    files.sort()
    
    for f in files:
        try:
            with open(f, 'r', encoding='utf-8') as file:
                content = file.read()
                if '---' not in content:
                    continue
                
                parts = content.split('---')
                if len(parts) < 2:
                    continue
                    
                frontmatter = parts[1]
                fm_lines = frontmatter.strip().split('\n')
                data = {}
                for line in fm_lines:
                    if ':' in line:
                        key, val = line.split(':', 1)
                        data[key.strip()] = val.strip().strip('"').strip("'")
                
                # Use forward slashes for cross-compatibility and URL format
                abs_path = os.path.abspath(f).replace('\\', '/')
                
                name = data.get('name', 'Unknown')
                trigger = data.get('trigger', '')
                desc = data.get('description', '')
                
                # Escape pipes in content to avoid breaking markdown tables
                trigger = trigger.replace('|', '\|')
                desc = desc.replace('|', '\|')
                
                lines.append(f"| **[{name}](file:///{abs_path})** | *{trigger}* | {desc} |")
        except Exception as e:
            print(f"Error processing {f}: {e}")
            
    return "\n".join(lines)

def update_agents_md(table_content):
    target_file = '.agent/agents.md'
    if not os.path.exists(target_file):
        print(f"Error: {target_file} not found.")
        return

    with open(target_file, 'r', encoding='utf-8') as f:
        content = f.read()

    marker = "## 5. Available Skills Index"
    if marker not in content:
        # Append if not found
        new_content = content + "\n\n" + marker + "\n\n" + table_content
    else:
        # Split and replace: Keep everything BEFORE the marker, add marker, add table
        # This assumes the table is at the END of the file. If not, this might truncate subsequent sections.
        # Based on previous file reads, section 5 is the last section.
        pre_marker = content.split(marker)[0]
        new_content = pre_marker + marker + "\n\n" + table_content + "\n"

    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Successfully updated {target_file}")

if __name__ == "__main__":
    table = generate_table()
    update_agents_md(table)
