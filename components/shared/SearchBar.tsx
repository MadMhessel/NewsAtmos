'use client'

import React, { useState } from 'react'
import { useRouter } from "@/lib/next-shim"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className="relative w-full group">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70 group-focus-within:text-primary transition-colors duration-300" />
      <Input
        placeholder="Поиск по сайту..."
        className="pl-9 h-9 rounded-full bg-secondary/30 border border-border text-sm placeholder:text-muted-foreground/60 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary/50 transition-all shadow-none"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  )
}