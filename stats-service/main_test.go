package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnvOrStats(t *testing.T) {
	t.Setenv("TEST_KEY", "value")
	if got := envOr("TEST_KEY", "default"); got != "value" {
		t.Fatalf("expected value, got %s", got)
	}
	if got := envOr("MISSING", "fallback"); got != "fallback" {
		t.Fatalf("expected fallback, got %s", got)
	}
}

func TestHandleCourseStatsNoData(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/rest/v1/evaluation_components" {
			w.Write([]byte("[]"))
		} else if r.URL.Path == "/rest/v1/marks" {
			w.Write([]byte("[]"))
		}
	}))
	defer ts.Close()

	w := httptest.NewRecorder()
	handleCourseStats(w, 1, ts.URL, "test-key")

	var stats CourseStats
	if err := json.NewDecoder(w.Body).Decode(&stats); err != nil {
		t.Fatalf("error decoding response: %v", err)
	}
	if stats.CourseID != 1 {
		t.Fatalf("expected course_id=1, got %d", stats.CourseID)
	}
	if stats.StudentCount != 0 {
		t.Fatalf("expected student_count=0, got %d", stats.StudentCount)
	}
}

func TestHandleComponentStatsNoData(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/rest/v1/evaluation_components" {
			w.Write([]byte("[]"))
		} else if r.URL.Path == "/rest/v1/marks" {
			w.Write([]byte("[]"))
		}
	}))
	defer ts.Close()

	w := httptest.NewRecorder()
	handleComponentStats(w, 1, ts.URL, "test-key")

	var stats []ComponentStats
	if err := json.NewDecoder(w.Body).Decode(&stats); err != nil {
		t.Fatalf("error decoding response: %v", err)
	}
	if len(stats) != 0 {
		t.Fatalf("expected empty stats, got %d", len(stats))
	}
}

func TestHandleCourseStatsWithData(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/rest/v1/evaluation_components" {
			w.Write([]byte(`[{"id":1,"course_id":1,"component_name":"Midterm","weightage":40,"max_marks":100}]`))
		} else if r.URL.Path == "/rest/v1/marks" {
			w.Write([]byte(`[{"student_id":"s1","component_id":1,"marks_obtained":80},{"student_id":"s2","component_id":1,"marks_obtained":60}]`))
		}
	}))
	defer ts.Close()

	w := httptest.NewRecorder()
	handleCourseStats(w, 1, ts.URL, "test-key")

	var stats CourseStats
	if err := json.NewDecoder(w.Body).Decode(&stats); err != nil {
		t.Fatalf("error decoding response: %v", err)
	}
	if stats.StudentCount != 2 {
		t.Fatalf("expected 2 students, got %d", stats.StudentCount)
	}
	if stats.AverageWeighted <= 0 {
		t.Fatalf("expected positive average, got %f", stats.AverageWeighted)
	}
}

func TestHandleComponentStatsWithData(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/rest/v1/evaluation_components" {
			w.Write([]byte(`[{"id":1,"course_id":1,"component_name":"Midterm","weightage":40,"max_marks":100}]`))
		} else if r.URL.Path == "/rest/v1/marks" {
			w.Write([]byte(`[{"student_id":"s1","component_id":1,"marks_obtained":80},{"student_id":"s2","component_id":1,"marks_obtained":60}]`))
		}
	}))
	defer ts.Close()

	w := httptest.NewRecorder()
	handleComponentStats(w, 1, ts.URL, "test-key")

	var stats []ComponentStats
	if err := json.NewDecoder(w.Body).Decode(&stats); err != nil {
		t.Fatalf("error decoding response: %v", err)
	}
	if len(stats) != 1 {
		t.Fatalf("expected 1 component, got %d", len(stats))
	}
	if stats[0].ComponentName != "Midterm" {
		t.Fatalf("expected Midterm, got %s", stats[0].ComponentName)
	}
	if stats[0].AverageMarks <= 0 {
		t.Fatalf("expected positive average, got %f", stats[0].AverageMarks)
	}
}