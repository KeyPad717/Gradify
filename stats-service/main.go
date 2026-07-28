package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
)

type EvaluationComponent struct {
	ID            int     `json:"id"`
	CourseID      int     `json:"course_id"`
	ComponentName string  `json:"component_name"`
	Weightage     float64 `json:"weightage"`
	MaxMarks      int     `json:"max_marks"`
}

type Mark struct {
	StudentID     string  `json:"student_id"`
	ComponentID   int     `json:"component_id"`
	MarksObtained float64 `json:"marks_obtained"`
}

type CourseStats struct {
	CourseID       int     `json:"course_id"`
	AverageWeighted float64 `json:"average_weighted_score"`
	StudentCount   int     `json:"student_count"`
}

type ComponentStats struct {
	ComponentID   int     `json:"component_id"`
	ComponentName string  `json:"component_name"`
	AverageMarks  float64 `json:"average_marks"`
	MaxMarks      int     `json:"max_marks"`
}

func main() {
	port := envOr("PORT", "8086")
	supabaseURL := envOr("SUPABASE_URL", "")
	supabaseKey := envOr("SUPABASE_KEY", envOr("SUPABASE_ANON_KEY", envOr("SUPABASE_SERVICE_ROLE_KEY", "")))

	http.HandleFunc("/api/stats/courses/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 5 {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		courseID, _ := strconv.Atoi(parts[4])

		if len(parts) == 6 && parts[5] == "components" {
			handleComponentStats(w, courseID, supabaseURL, supabaseKey)
		} else {
			handleCourseStats(w, courseID, supabaseURL, supabaseKey)
		}
	})

	log.Printf("stats-service listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func handleCourseStats(w http.ResponseWriter, courseID int, url, key string) {
	components, err := fetchComponents(courseID, url, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	marks, err := fetchMarks(courseID, url, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Group marks by student
	studentMarks := make(map[string]float64)
	compMap := make(map[int]EvaluationComponent)
	for _, c := range components {
		compMap[c.ID] = c
	}

	for _, m := range marks {
		comp, ok := compMap[m.ComponentID]
		if !ok {
			continue
		}
		max := comp.MaxMarks
		if max <= 0 {
			max = 100
		}
		weighted := (m.MarksObtained / float64(max)) * comp.Weightage
		studentMarks[m.StudentID] += weighted
	}

	var totalWeighted float64
	for _, score := range studentMarks {
		totalWeighted += score
	}

	count := len(studentMarks)
	avg := 0.0
	if count > 0 {
		avg = totalWeighted / float64(count)
	}

	json.NewEncoder(w).Encode(CourseStats{
		CourseID:       courseID,
		AverageWeighted: avg,
		StudentCount:   count,
	})
}

func handleComponentStats(w http.ResponseWriter, courseID int, url, key string) {
	components, err := fetchComponents(courseID, url, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	marks, err := fetchMarks(courseID, url, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	compStats := make(map[int]*ComponentStats)
	for _, c := range components {
		compStats[c.ID] = &ComponentStats{
			ComponentID:   c.ID,
			ComponentName: c.ComponentName,
			MaxMarks:      c.MaxMarks,
		}
	}

	compCounts := make(map[int]int)
	compTotals := make(map[int]float64)

	for _, m := range marks {
		compTotals[m.ComponentID] += m.MarksObtained
		compCounts[m.ComponentID]++
	}

	var result []ComponentStats
	for _, c := range components {
		stats := compStats[c.ID]
		if count := compCounts[c.ID]; count > 0 {
			stats.AverageMarks = compTotals[c.ID] / float64(count)
		}
		result = append(result, *stats)
	}

	json.NewEncoder(w).Encode(result)
}

func fetchComponents(courseID int, url, key string) ([]EvaluationComponent, error) {
	fullURL := fmt.Sprintf("%s/rest/v1/evaluation_components?course_id=eq.%d&select=*", url, courseID)
	req, _ := http.NewRequest("GET", fullURL, nil)
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Error fetching components: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Supabase components error: status %d", resp.StatusCode)
		return nil, fmt.Errorf("supabase error: %d", resp.StatusCode)
	}

	var comps []EvaluationComponent
	if err := json.NewDecoder(resp.Body).Decode(&comps); err != nil {
		log.Printf("Error decoding components: %v", err)
		return nil, err
	}
	return comps, nil
}

func fetchMarks(courseID int, url, key string) ([]Mark, error) {
	fullURL := fmt.Sprintf("%s/rest/v1/marks?course_id=eq.%d&select=student_id,component_id,marks_obtained", url, courseID)
	req, _ := http.NewRequest("GET", fullURL, nil)
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Error fetching marks: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Supabase marks error: status %d", resp.StatusCode)
		return nil, fmt.Errorf("supabase error: %d", resp.StatusCode)
	}

	var marks []Mark
	if err := json.NewDecoder(resp.Body).Decode(&marks); err != nil {
		log.Printf("Error decoding marks: %v", err)
		return nil, err
	}
	return marks, nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
