--[[
    LinkClient.client.lua
    Ubicación recomendada: StarterPlayer/StarterPlayerScripts/LinkClient
    o dentro de una ScreenGui en StarterGui.

    Descripción:
    Interfaz de usuario para que el staff ingrese el código de vinculación de Discord
    obtenido mediante el comando /vincular. Envía la petición de forma segura
    al servidor mediante RemoteEvent.
--]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local localPlayer = Players.LocalPlayer
local playerGui = localPlayer:WaitForChild("PlayerGui")

-- Esperar a que los Remotes estén listos en ReplicatedStorage
local remotesFolder = ReplicatedStorage:WaitForChild("StaffRemotes", 15)
if not remotesFolder then
	warn("[LinkClient] No se encontró la carpeta 'StaffRemotes' en ReplicatedStorage.")
	return
end

local linkEvent = remotesFolder:WaitForChild("StaffLinkEvent", 15)
local linkResultEvent = remotesFolder:WaitForChild("StaffLinkResultEvent", 15)

if not linkEvent or not linkResultEvent then
	warn("[LinkClient] No se encontraron los RemoteEvents necesarios para la vinculación.")
	return
end

--------------------------------------------------------------------------------
-- CREACIÓN DINÁMICA DE LA INTERFAZ (SCREEN GUI)
--------------------------------------------------------------------------------
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "StaffLinkGui"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = playerGui

-- Botón flotante para abrir la ventana
local openButton = Instance.new("TextButton")
openButton.Name = "OpenButton"
openButton.Size = UDim2.new(0, 140, 0, 36)
openButton.Position = UDim2.new(0, 16, 1, -52)
openButton.BackgroundColor3 = Color3.fromRGB(88, 101, 242) -- Discord Blurple
openButton.TextColor3 = Color3.fromRGB(255, 255, 255)
openButton.Font = Enum.Font.GothamBold
openButton.TextSize = 13
openButton.Text = "🔗 Vincular Discord"
openButton.AutoButtonColor = true
openButton.Parent = screenGui

local openCorner = Instance.new("UICorner")
openCorner.CornerRadius = UDim.new(0, 8)
openCorner.Parent = openButton

-- Marco Principal Modal (Ventana flotante)
local modalFrame = Instance.new("Frame")
modalFrame.Name = "ModalFrame"
modalFrame.Size = UDim2.new(0, 360, 0, 240)
modalFrame.Position = UDim2.new(0.5, -180, 0.5, -120)
modalFrame.BackgroundColor3 = Color3.fromRGB(32, 34, 37)
modalFrame.BorderSizePixel = 0
modalFrame.Visible = false
modalFrame.ClipsDescendants = true
modalFrame.Parent = screenGui

local modalCorner = Instance.new("UICorner")
modalCorner.CornerRadius = UDim.new(0, 12)
modalCorner.Parent = modalFrame

local modalStroke = Instance.new("UIStroke")
modalStroke.Color = Color3.fromRGB(54, 57, 63)
modalStroke.Thickness = 1.5
modalStroke.Parent = modalFrame

-- Título del Modal
local titleLabel = Instance.new("TextLabel")
titleLabel.Name = "TitleLabel"
titleLabel.Size = UDim2.new(1, -40, 0, 40)
titleLabel.Position = UDim2.new(0, 16, 0, 12)
titleLabel.BackgroundTransparency = 1
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextSize = 16
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.Text = "🛡️ Vincular con Discord"
titleLabel.Parent = modalFrame

-- Botón Cerrar (X)
local closeButton = Instance.new("TextButton")
closeButton.Name = "CloseButton"
closeButton.Size = UDim2.new(0, 28, 0, 28)
closeButton.Position = UDim2.new(1, -38, 0, 14)
closeButton.BackgroundColor3 = Color3.fromRGB(47, 49, 54)
closeButton.TextColor3 = Color3.fromRGB(185, 187, 190)
closeButton.Font = Enum.Font.GothamBold
closeButton.TextSize = 14
closeButton.Text = "✕"
closeButton.Parent = modalFrame

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 6)
closeCorner.Parent = closeButton

-- Descripción
local descLabel = Instance.new("TextLabel")
descLabel.Name = "DescLabel"
descLabel.Size = UDim2.new(1, -32, 0, 34)
descLabel.Position = UDim2.new(0, 16, 0, 52)
descLabel.BackgroundTransparency = 1
descLabel.TextColor3 = Color3.fromRGB(185, 187, 190)
descLabel.Font = Enum.Font.Gotham
descLabel.TextSize = 12
descLabel.TextWrapped = true
descLabel.TextXAlignment = Enum.TextXAlignment.Left
descLabel.Text = "Escribe el código temporal obtenido en Discord usando /vincular:"
descLabel.Parent = modalFrame

-- Campo de Entrada (TextBox)
local codeBox = Instance.new("TextBox")
codeBox.Name = "CodeBox"
codeBox.Size = UDim2.new(1, -32, 0, 44)
codeBox.Position = UDim2.new(0, 16, 0, 94)
codeBox.BackgroundColor3 = Color3.fromRGB(47, 49, 54)
codeBox.TextColor3 = Color3.fromRGB(255, 255, 255)
codeBox.PlaceholderColor3 = Color3.fromRGB(114, 118, 125)
codeBox.PlaceholderText = "Ej: ABCDEF o ABC-DEF"
codeBox.Font = Enum.Font.Code
codeBox.TextSize = 16
codeBox.ClearTextOnFocus = false
codeBox.Text = ""
codeBox.Parent = modalFrame

local boxCorner = Instance.new("UICorner")
boxCorner.CornerRadius = UDim.new(0, 8)
boxCorner.Parent = codeBox

-- Etiqueta de Estado / Feedback
local statusLabel = Instance.new("TextLabel")
statusLabel.Name = "StatusLabel"
statusLabel.Size = UDim2.new(1, -32, 0, 24)
statusLabel.Position = UDim2.new(0, 16, 0, 142)
statusLabel.BackgroundTransparency = 1
statusLabel.Font = Enum.Font.Gotham
statusLabel.TextSize = 12
statusLabel.TextWrapped = true
statusLabel.Text = ""
statusLabel.Parent = modalFrame

-- Botón Enviar Código
local submitButton = Instance.new("TextButton")
submitButton.Name = "SubmitButton"
submitButton.Size = UDim2.new(1, -32, 0, 40)
submitButton.Position = UDim2.new(0, 16, 0, 178)
submitButton.BackgroundColor3 = Color3.fromRGB(88, 101, 242)
submitButton.TextColor3 = Color3.fromRGB(255, 255, 255)
submitButton.Font = Enum.Font.GothamBold
submitButton.TextSize = 14
submitButton.Text = "Confirmar Vinculación"
submitButton.Parent = modalFrame

local submitCorner = Instance.new("UICorner")
submitCorner.CornerRadius = UDim.new(0, 8)
submitCorner.Parent = submitButton

--------------------------------------------------------------------------------
-- LÓGICA DE INTERACCIÓN
--------------------------------------------------------------------------------
local isSubmitting = false

local function setModalVisible(visible)
	modalFrame.Visible = visible
	if visible then
		statusLabel.Text = ""
		codeBox.Text = ""
	end
end

openButton.MouseButton1Click:Connect(function()
	setModalVisible(not modalFrame.Visible)
end)

closeButton.MouseButton1Click:Connect(function()
	setModalVisible(false)
end)

-- Formateo automático a mayúsculas mientras el usuario escribe
codeBox:GetPropertyChangedSignal("Text"):Connect(function()
	local upper = string.upper(codeBox.Text)
	if codeBox.Text ~= upper then
		codeBox.Text = upper
	end
end)

local function submitCode()
	if isSubmitting then return end

	local enteredCode = string.gsub(codeBox.Text, "%s+", "")
	if string.len(enteredCode) < 4 then
		statusLabel.TextColor3 = Color3.fromRGB(237, 66, 69) -- Rojo Discord
		statusLabel.Text = "Ingresa un código válido de 6 caracteres."
		return
	end

	isSubmitting = true
	submitButton.Text = "Verificando..."
	submitButton.BackgroundColor3 = Color3.fromRGB(79, 84, 92)
	statusLabel.TextColor3 = Color3.fromRGB(254, 231, 92) -- Amarillo
	statusLabel.Text = "Conectando con el servidor..."

	-- Envía únicamente el código ingresado. La identidad del usuario es validada en el servidor.
	linkEvent:FireServer(enteredCode)
end

submitButton.MouseButton1Click:Connect(submitCode)
codeBox.FocusLost:Connect(function(enterPressed)
	if enterPressed then
		submitCode()
	end
end)

-- Respuesta recibida desde el servidor
linkResultEvent.OnClientEvent:Connect(function(success, message)
	isSubmitting = false
	submitButton.Text = "Confirmar Vinculación"
	submitButton.BackgroundColor3 = Color3.fromRGB(88, 101, 242)

	if success then
		statusLabel.TextColor3 = Color3.fromRGB(87, 242, 135) -- Verde éxito
		statusLabel.Text = message or "¡Cuenta vinculada con éxito!"
		task.delay(3, function()
			if modalFrame.Visible and statusLabel.Text == message then
				setModalVisible(false)
			end
		end)
	else
		statusLabel.TextColor3 = Color3.fromRGB(237, 66, 69) -- Rojo error
		statusLabel.Text = message or "Error al verificar el código."
	end
end)
