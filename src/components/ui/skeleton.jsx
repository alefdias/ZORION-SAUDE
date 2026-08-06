"use client"
import React from "react"

function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
      {...props}
    />
  )
}

export { Skeleton }
export default Skeleton
