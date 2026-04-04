"use client"

import { useRef, useCallback } from "react"
import Editor, { OnMount } from "@monaco-editor/react"
import type { editor } from "monaco-editor"

interface JsonEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string | number
}

export function JsonEditor({ value, onChange, readOnly = false, height = "500px" }: JsonEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  const handleChange = useCallback((newValue: string | undefined) => {
    if (onChange && newValue !== undefined) {
      onChange(newValue)
    }
  }, [onChange])

  return (
    <div className="border rounded-lg overflow-hidden bg-[#1e1e1e]">
      <Editor
        height={height}
        defaultLanguage="json"
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          folding: true,
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  )
}
