package main

import "testing"

func TestSimple(t *testing.T) {
	expected := 2
	actual := 1 + 1
	if actual != expected {
		t.Errorf("Expected %d, but got %d", expected, actual)
	}
}

func TestHealthCheck(t *testing.T) {
	// Simple dummy test for logic
	isHealthy := true
	if !isHealthy {
		t.Error("Health check failed")
	}
}
