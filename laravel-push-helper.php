<?php
// Laravel Helper for Push Notifications
// Place this in your Laravel project: app/Services/PushNotificationService.php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PushNotificationService
{
    private $socketUrl;

    public function __construct()
    {
        $this->socketUrl = config('app.socket_url', 'http://localhost:3001');
    }

    /**
     * Send push notification to specific user (works even if browser is closed)
     */
    public function sendToUser($userId, $title, $message, $options = [])
    {
        try {
            $payload = [
                'userId' => $userId,
                'title' => $title,
                'message' => $message,
                'icon' => $options['icon'] ?? '/icon-192x192.png',
                'url' => $options['url'] ?? '/',
                'data' => $options['data'] ?? []
            ];

            $response = Http::post($this->socketUrl . '/api/push/send', $payload);

            if ($response->successful()) {
                Log::info('Push notification sent successfully', [
                    'userId' => $userId,
                    'title' => $title,
                    'response' => $response->json()
                ]);
                return $response->json();
            } else {
                Log::error('Failed to send push notification', [
                    'userId' => $userId,
                    'status' => $response->status(),
                    'response' => $response->body()
                ]);
                return ['success' => false, 'error' => 'HTTP ' . $response->status()];
            }

        } catch (\Exception $e) {
            Log::error('Push notification exception', [
                'userId' => $userId,
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Broadcast push notification to all users
     */
    public function broadcast($title, $message, $options = [])
    {
        try {
            $payload = [
                'title' => $title,
                'message' => $message,
                'icon' => $options['icon'] ?? '/icon-192x192.png',
                'url' => $options['url'] ?? '/',
                'data' => $options['data'] ?? []
            ];

            $response = Http::post($this->socketUrl . '/api/push/broadcast', $payload);

            if ($response->successful()) {
                Log::info('Push notification broadcast sent successfully', [
                    'title' => $title,
                    'response' => $response->json()
                ]);
                return $response->json();
            } else {
                Log::error('Failed to broadcast push notification', [
                    'status' => $response->status(),
                    'response' => $response->body()
                ]);
                return ['success' => false, 'error' => 'HTTP ' . $response->status()];
            }

        } catch (\Exception $e) {
            Log::error('Push notification broadcast exception', [
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send socket notification to refresh content for specific company
     */
    public function refreshCompanyDashboard($companyId, $component = 'dashboard', $data = [])
    {
        try {
            $payload = [
                'companyId' => $companyId,
                'page' => 'dashboard',
                'component' => $component,
                'action' => 'refresh',
                'data' => array_merge([
                    'type' => 'company_dashboard_refresh',
                    'company_id' => $companyId,
                    'timestamp' => now()->toISOString()
                ], $data)
            ];

            $response = Http::post($this->socketUrl . '/api/content/refresh', $payload);

            if ($response->successful()) {
                Log::info('Company dashboard refresh sent successfully', [
                    'companyId' => $companyId,
                    'component' => $component,
                    'response' => $response->json()
                ]);
                return $response->json();
            } else {
                Log::error('Failed to refresh company dashboard', [
                    'companyId' => $companyId,
                    'status' => $response->status(),
                    'response' => $response->body()
                ]);
                return ['success' => false, 'error' => 'HTTP ' . $response->status()];
            }

        } catch (\Exception $e) {
            Log::error('Company dashboard refresh exception', [
                'companyId' => $companyId,
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send socket notification to refresh content for current user's company
     */
    public function refreshCurrentCompanyDashboard($component = 'dashboard', $data = [])
    {
        $companyId = auth()->user()->company_id ?? null;
        
        if (!$companyId) {
            Log::warning('Cannot refresh company dashboard - user has no company');
            return ['success' => false, 'error' => 'User has no company'];
        }

        return $this->refreshCompanyDashboard($companyId, $component, $data);
    }

    /**
     * Send push notification when order is completed (example)
     */
    public function orderCompleted($userId, $orderNumber)
    {
        return $this->sendToUser($userId, 
            '✅ Order Completed', 
            "Your order #{$orderNumber} has been completed and is ready for pickup!",
            [
                'icon' => '/icons/order-complete.png',
                'url' => "/orders/{$orderNumber}",
                'data' => [
                    'type' => 'order_completed',
                    'order_number' => $orderNumber,
                    'timestamp' => now()->toISOString()
                ]
            ]
        );
    }

    /**
     * Send push notification for payment reminder
     */
    public function paymentReminder($userId, $invoiceNumber, $amount)
    {
        return $this->sendToUser($userId,
            '💰 Payment Reminder',
            "Invoice #{$invoiceNumber} of Rs. {$amount} is due. Please make payment to avoid late fees.",
            [
                'icon' => '/icons/payment-reminder.png',
                'url' => "/invoices/{$invoiceNumber}",
                'data' => [
                    'type' => 'payment_reminder',
                    'invoice_number' => $invoiceNumber,
                    'amount' => $amount
                ]
            ]
        );
    }

    /**
     * Send push notification for new message
     */
    public function newMessage($userId, $senderName, $message)
    {
        return $this->sendToUser($userId,
            "💬 New Message from {$senderName}",
            $message,
            [
                'icon' => '/icons/message.png',
                'url' => '/messages',
                'data' => [
                    'type' => 'new_message',
                    'sender' => $senderName
                ]
            ]
        );
    }
}

// Usage Examples:
/*
// In your Laravel Controller:

use App\Services\PushNotificationService;

class OrderController extends Controller 
{
    private $pushService;

    public function __construct(PushNotificationService $pushService)
    {
        $this->pushService = $pushService;
    }

    public function completeOrder($orderId)
    {
        $order = Order::find($orderId);
        
        // Update order status
        $order->update(['status' => 'completed']);
        
        // Send push notification (works even if user's browser is closed)
        $this->pushService->orderCompleted($order->user_id, $order->order_number);
        
        return response()->json(['success' => true]);
    }
}

// Or use it anywhere:
$pushService = new PushNotificationService();
$pushService->sendToUser('user_123', 'Hello!', 'This is a test notification');
*/

    /**
     * Example: Send notification when sale is created (company-specific)
     */
    public function saleCreated($saleId, $companyId, $customerName, $amount)
    {
        // Refresh dashboard for the specific company
        $this->refreshCompanyDashboard($companyId, 'sales', [
            'sale_id' => $saleId,
            'customer_name' => $customerName,
            'amount' => $amount,
            'action' => 'sale_created'
        ]);

        // Also send push notification to company users
        return $this->broadcast(
            '💰 New Sale Created',
            "Sale to {$customerName} for Rs. {$amount} has been created!",
            [
                'icon' => '/icons/sale.png',
                'url' => "/sales/{$saleId}",
                'data' => [
                    'type' => 'sale_created',
                    'sale_id' => $saleId,
                    'company_id' => $companyId
                ]
            ]
        );
    }
}