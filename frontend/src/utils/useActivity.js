/**
 * hooks/useActivity.js
 * ─────────────────────
 * Custom hook for activity data fetching and mutations.
 * Centralises all axios calls so pages stay clean.
 */

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export function useActivities(autoFetch = true) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/activities");
      setActivities(res.data.data ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (autoFetch) fetch(); }, [autoFetch, fetch]);

  return { activities, loading, error, refetch: fetch };
}

export function useActivity(activityId) {
  const [activity, setActivity] = useState(null);
  const [news, setNews] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!activityId) return;
    setLoading(true);
    setError(null);
    try {
      const [actRes, newsRes, partRes] = await Promise.all([
        axios.get(`/api/activities/${activityId}`),
        axios.get(`/api/activities/${activityId}/news`),
        axios.get(`/api/attendance/${activityId}`),
      ]);
      setActivity(actRes.data.data);
      setNews(newsRes.data.data ?? []);
      setParticipants(partRes.data.data ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const changeStatus = async (newStatus) => {
    await axios.patch(`/api/activities/${activityId}/status`, { newStatus });
    await fetch();
  };

  const uploadReport = async (file) => {
    const fd = new FormData();
    fd.append("report", file);
    await axios.post(`/api/activities/${activityId}/report`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await fetch();
  };

  const addNews = async (data) => {
    await axios.post(`/api/activities/${activityId}/news`, data);
    await fetch();
  };

  const updateSpending = async (amount) => {
    await axios.patch(`/api/activities/${activityId}`, { total_spendings: amount });
    await fetch();
  };

  const unlock = async (reason = "") => {
    await axios.post(`/api/activities/${activityId}/unlock`, { reason });
    await fetch();
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = {
    attendedCount: participants.filter((p) => p.attendance_status === "Attended").length,
    absentExcused: participants.filter((p) => p.attendance_status === "Absent Excused").length,
    absentUnexcused: participants.filter((p) => p.attendance_status === "Absent Unexcused").length,
    newsCount: news.length,
    isLocked: activity?.locked === "TRUE",
    hasReport: !!activity?.pdf_report_url?.trim(),
    isExternal: activity?.external_organization === "TRUE",
  };

  return {
    activity, news, participants, loading, error, stats,
    refetch: fetch, changeStatus, uploadReport, addNews, updateSpending, unlock,
  };
}
