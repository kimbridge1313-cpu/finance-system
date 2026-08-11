from pathlib import Path
p = Path('src/App.jsx')
s = p.read_text()
s = s.replace(
    '    if (!isAdmin && currentUser.department !== "all" && targetDepartment && targetDepartment !== currentUser.department) {\n      setQuickVoiceMessage(`這筆規則屬於${getDepartmentLabel(targetDepartment, departments)}，目前帳號無法替其他部門記帳。`);',
    '    if (!isAdmin && currentUser.department !== "all" && targetDepartment && targetDepartment !== currentUser.department) {\n      setQuickVoiceMatched(false);\n      setQuickVoiceMessage(`這筆規則屬於${getDepartmentLabel(targetDepartment, departments)}，目前帳號無法替其他部門記帳。`);'
)
s = s.replace('{entryType === "expense" && <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-400">廠商</p>', '{showCashVendorSelect && <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-400">廠商</p>')
p.write_text(s)
print('refined')
