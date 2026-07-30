package com.example.user_service.services;

public class RoleResolutionException extends RuntimeException {
    public RoleResolutionException(String message) {
        super(message);
    }

    public RoleResolutionException(String message, Throwable cause) {
        super(message, cause);
    }
}
