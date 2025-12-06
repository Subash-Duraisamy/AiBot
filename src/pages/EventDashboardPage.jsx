import React from "react";
import EventDashboard from "../components/EventDashboard";

export default function EventDashboardPage() {
  // We pull the token from localStorage where Chat stored it
  const accessToken = localStorage.getItem("fig_token");

  return (
    <div style={{ padding: "20px" }}>
      <h2>Event Dashboard</h2>
      <p>Full screen event planner — extract, edit, approve.</p>

      <EventDashboard
        accessToken={accessToken}
        defaultCalendar="primary"
        timezone="Asia/Kolkata"
      />
    </div>
  );
}
