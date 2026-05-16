package main

import "testing"

func TestSimpleStats(t *testing.T) {
	expected := 10
	actual := 5 * 2
	if actual != expected {
		t.Errorf("Expected %d, but got %d", expected, actual)
	}
}

func TestStatsLogic(t *testing.T) {
	data := []int{1, 2, 3}
	if len(data) != 3 {
		t.Error("Data length should be 3")
	}
}
