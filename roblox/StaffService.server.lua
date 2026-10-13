--[[
    StaffService.server.lua
    Ubicación recomendada: ServerScriptService/StaffService
    
    Descripción:
    Servicio de servidor en Luau para Roblox Studio que sincroniza la presencia
    de los jugadores con la API de Railway en tiempo real y gestiona la verificación
    segura de códigos de vinculación para el equipo del Staff.
--]]

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

--------------------------------------------------------------------------------
-- CONFIGURACIÓN DEL SERVICIO
--------------------------------------------------------------------------------
-- IMPORTANTE: Cambia esta URL por la URL pública generada en Railway para tu aplicación.
-- Ejemplo: "https://mi-bot-staff.up.railway.app" (sin barra diagonal al final)
local API_BASE_URL = "https://tu-proyecto.up.railway.app"

-- Debe coincidir exactamente con el valor configurado en ROBLOX_API_KEY (.env / Railway)
local ROBLOX_API_KEY = "CAMBIAR_POR_TU_ROBLOX_API_KEY_DE_AL_MENOS_32_CARACTERES"

-- Intervalo de envío de presencia (segundos)
local HEARTBEAT_INTERVAL = 25

--------------------------------------------------------------------------------
-- INICIALIZACIÓN DE REMOTES
--------------------------------------------------------------------------------
local remotesFolder = ReplicatedStorage:FindFirstChild("StaffRemotes")
if not remotesFolder then
	remotesFolder = Instance.new("Folder")
	remotesFolder.Name = "StaffRemotes"
	remotesFolder.Parent = ReplicatedStorage
end

local linkEvent = remotesFolder:FindFirstChild("StaffLinkEvent")
if not linkEvent then
	linkEvent = Instance.new("RemoteEvent")
	linkEvent.Name = "StaffLinkEvent"
	linkEvent.Parent = remotesFolder
end

local linkResultEvent = remotesFolder:FindFirstChild("StaffLinkResultEvent")
if not linkResultEvent then
	linkResultEvent = Instance.new("RemoteEvent")
	linkResultEvent.Name = "StaffLinkResultEvent"
	linkResultEvent.Parent = remotesFolder
end

--------------------------------------------------------------------------------
-- FUNCIONES AUXILIARES DE RED
--------------------------------------------------------------------------------
local function getHeaders()
	return {
		["Content-Type"] = "application/json",
		["Authorization"] = "Bearer " .. ROBLOX_API_KEY,
	}
end

-- Genera un ID de trabajo representativo incluso en pruebas dentro de Studio
local function getJobId()
	if game.JobId and game.JobId ~= "" then
		return game.JobId
	end
	return "studio-dev-job-" .. tostring(game.PlaceId)
end

--------------------------------------------------------------------------------
-- ENVÍO DE PRESENCIA (HEARTBEAT)
--------------------------------------------------------------------------------
local function sendPresenceHeartbeat()
	local activePlayers = Players:GetPlayers()
	local playersPayload = {}

	for _, player in ipairs(activePlayers) do
		table.insert(playersPayload, {
			userId = player.UserId,
			username = player.Name,
			displayName = player.DisplayName,
		})
	end

	local payload = {
		placeId = game.PlaceId,
		jobId = getJobId(),
		timestamp = os.time(),
		players = playersPayload,
	}

	local success, result = pcall(function()
		local bodyJson = HttpService:JSONEncode(payload)
		local url = API_BASE_URL .. "/api/roblox/presence"
		
		return HttpService:RequestAsync({
			Url = url,
			Method = "POST",
			Headers = getHeaders(),
			Body = bodyJson,
		})
	end)

	if not success then
		warn("[StaffService] Error en petición de presencia:", tostring(result))
		return
	end

	if result.Success and result.StatusCode == 200 then
		-- Petición exitosa
		-- Descomentar la siguiente línea si deseas inspeccionar la respuesta en la consola
		-- print("[StaffService] Presencia sincronizada correctamente (" .. #playersPayload .. " jugadores)")
	else
		warn("[StaffService] Falló respuesta de presencia (" .. tostring(result.StatusCode) .. "):", result.Body)
	end
end

--------------------------------------------------------------------------------
-- GESTIÓN DE VINCULACIÓN DE CUENTAS
--------------------------------------------------------------------------------
linkEvent.OnServerEvent:Connect(function(player, rawCode)
	if typeof(rawCode) ~= "string" then
		linkResultEvent:FireClient(player, false, "El código ingresado no es válido.")
		return
	end

	local cleanCode = string.gsub(rawCode, "[^%w]", ""):upper()
	if string.len(cleanCode) < 4 or string.len(cleanCode) > 16 then
		linkResultEvent:FireClient(player, false, "Formato de código inválido. Debe tener entre 4 y 8 caracteres.")
		return
	end

	-- SEGURIDAD CRÍTICA:
	-- El robloxUserId y username se obtienen DIRECTAMENTE del objeto Player de Roblox en el servidor.
	-- Nunca confiamos en datos de identidad enviados por el cliente.
	local payload = {
		robloxUserId = player.UserId,
		username = player.Name,
		code = cleanCode,
		timestamp = os.time(),
	}

	local requestSuccess, response = pcall(function()
		local bodyJson = HttpService:JSONEncode(payload)
		local url = API_BASE_URL .. "/api/roblox/link/verify"

		return HttpService:RequestAsync({
			Url = url,
			Method = "POST",
			Headers = getHeaders(),
			Body = bodyJson,
		})
	end)

	if not requestSuccess then
		warn("[StaffService] Error de conexión al verificar código:", tostring(response))
		linkResultEvent:FireClient(player, false, "Error al comunicarse con el servidor central. Intenta más tarde.")
		return
	end

	local decodeOk, data = pcall(function()
		return HttpService:JSONDecode(response.Body)
	end)

	if not decodeOk or typeof(data) ~= "table" then
		linkResultEvent:FireClient(player, false, "Respuesta inválida del servidor central.")
		return
	end

	if response.StatusCode == 200 and data.ok == true then
		print(string.format("[StaffService] Jugador %s (%d) vinculado exitosamente con Discord", player.Name, player.UserId))
		linkResultEvent:FireClient(player, true, "¡Cuenta vinculada con éxito a tu usuario de Discord!")
	else
		local errorMsg = data.message or "No se pudo vincular la cuenta. Verifica que el código no haya expirado."
		linkResultEvent:FireClient(player, false, errorMsg)
	end
end)

--------------------------------------------------------------------------------
-- CICLO PRINCIPAL
--------------------------------------------------------------------------------
task.spawn(function()
	print("[StaffService] Servicio de presencia y vinculación de Staff iniciado.")
	
	-- Espera inicial para permitir arranque completo del servidor
	task.wait(5)

	while true do
		sendPresenceHeartbeat()
		task.wait(HEARTBEAT_INTERVAL)
	end
end)
